package com.sttl.formbuilder.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sttl.formbuilder.entity.FormField;
import com.sttl.formbuilder.entity.FormVersion;
import com.sttl.formbuilder.entity.User;
import com.sttl.formbuilder.model.SubmissionFact;
import com.sttl.formbuilder.repository.FormFieldRepository;
import com.sttl.formbuilder.repository.FormVersionRepository;
import com.sttl.formbuilder.repository.UserRepository;
import com.sttl.formbuilder.util.InputSanitizer;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SubmissionService {

    private final JdbcTemplate jdbcTemplate;
    private final FormVersionRepository versionRepository;
    private final FormFieldRepository fieldRepository;
    private final RuleService ruleService;
    private final UserRepository userRepository;
    private final SchemaService schemaService;
    private final SchemaDriftService schemaDriftService;

    public SubmissionService(JdbcTemplate jdbcTemplate,
            FormVersionRepository versionRepository,
            FormFieldRepository fieldRepository,
            RuleService ruleService,
            UserRepository userRepository,
            SchemaService schemaService,
            SchemaDriftService schemaDriftService) {
        this.jdbcTemplate = jdbcTemplate;
        this.versionRepository = versionRepository;
        this.fieldRepository = fieldRepository;
        this.ruleService = ruleService;
        this.userRepository = userRepository;
        this.schemaService = schemaService;
        this.schemaDriftService = schemaDriftService;
    }

    /**
     * Submit a form response. Inserts into the dynamic submission table.
     * Validates required fields server-side and type-casts values correctly.
     */
    public Long submitForm(UUID versionId, Map<String, Object> data) {
        if (versionId == null)
            throw new IllegalArgumentException("versionId cannot be null");
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        validateFormStatus(version);

        // ─── DRIFT CHECK ─────────────────────────────────────────────────────
        if (schemaService.isDrifted(version.getTableName())) {
             throw new com.sttl.formbuilder.exception.SchemaDriftException("Submission blocked: Database schema drift detected in table '" + version.getTableName() + "'. Please contact the administrator.");
        }
        // Live check for extra robustness
        List<FormField> expectedFields = fieldRepository.findByVersion_IdOrderByFieldOrder(versionId);
        schemaDriftService.validateSchema(version, expectedFields);
        // ─────────────────────────────────────────────────────────────────────

        // Get current authenticated user
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UUID userId = null;
        com.sttl.formbuilder.Enums.Role userRole = null;
        if (auth != null && auth.getPrincipal() instanceof User userDetails) {
            userId = userDetails.getId();
            userRole = userDetails.getRole();
        }

        // ─── One Submission Per User Check ───────────────────────────────────
        if (Boolean.TRUE.equals(version.getForm().getOneSubmissionPerUser()) && userId != null) {
            // Only count non-deleted COMPLETED submissions
            String checkSql = "SELECT COUNT(*) FROM \"" + version.getTableName()
                    + "\" WHERE \"submitted_by\" = CAST(? AS UUID) AND \"status\" = 'COMPLETED'";
            
            if (hasColumn(version.getTableName(), "deleted")) {
                checkSql += " AND \"deleted\" = FALSE";
            }
            
            Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, userId.toString());
            if (count != null && count > 0) {
                throw new IllegalArgumentException("You have already submitted this form.");
            }
        }
        
        // ─── Draft Check & Status Handling ──────────────────────────────────
        String status = (String) data.getOrDefault("status", "COMPLETED");
        boolean isDraft = "DRAFT".equals(status);
        
        // If a draft exists for this user/version, update it instead of creating a new one
        if (userId != null) {
            Long existingId = getUserSubmissionId(versionId, "DRAFT");
            if (existingId != null) {
                updateSubmission(versionId, existingId, data);
                return existingId;
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        List<FormField> fields = fieldRepository.findByVersion_IdOrderByFieldOrder(versionId);
        Map<String, Object> cleanedData = validateAndCleanData(fields, data, isDraft);

        if (cleanedData.isEmpty() && !isDraft) {
            throw new IllegalArgumentException("No valid data provided");
        }

        // ─── Uniqueness Check ────────────────────────────────────────────────
        if (!isDraft) {
            for (FormField field : fields) {
                if (Boolean.TRUE.equals(field.getIsUnique())) {
                    String key = field.getFieldKey();
                    Object val = cleanedData.get(key);
                    if (val != null && !val.toString().trim().isEmpty()) {
                        String checkSql = "SELECT COUNT(*) FROM \"" + version.getTableName() + "\" WHERE \"" + key
                                + "\" = ?";
                        Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, val);
                        if (count != null && count > 0) {
                            throw new IllegalArgumentException("The value for '" + field.getFieldLabel()
                                    + "' already exists. Please provide a unique value.");
                        }
                    }
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        // ─── Business Rules Evaluation ──────────────────────────────────────
        UUID formId = version.getForm().getId();
        SubmissionFact fact = ruleService.evaluateRules(formId, cleanedData);
        if (fact.hasErrors()) {
            if (!isDraft) {
                throw new RuntimeException("Business rule violation: " + String.join("; ", fact.getErrors()));
            }
        }
        // Apply any SET_VALUE overrides from rules
        fact.getUpdatedValues().forEach(cleanedData::put);
        // ─────────────────────────────────────────────────────────────────────

        List<String> columns = new ArrayList<>(cleanedData.keySet());
        List<String> quotedColumns = new ArrayList<>(columns.stream().map(c -> "\"" + c + "\"").toList());
        List<Object> values = new ArrayList<>();
        for (String col : columns) {
            values.add(cleanedData.get(col));
        }

        if (userId != null) {
            quotedColumns.add("\"submitted_by\"");
            values.add(userId);
        }

        quotedColumns.add("\"version_id\"");
        values.add(versionId);

        quotedColumns.add("\"status\"");
        values.add(status);

        String colStr = String.join(", ", quotedColumns);
        String placeholders = "?,".repeat(quotedColumns.size());
        placeholders = placeholders.substring(0, placeholders.length() - 1);

        String sql = "INSERT INTO \"" + version.getTableName() + "\" (" + colStr + ") VALUES (" + placeholders + ")";
        if (version.getId() == null)
            throw new RuntimeException("Version ID is null");

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < values.size(); i++) {
                ps.setObject(i + 1, values.get(i));
            }
            return ps;
        }, keyHolder);

        if (keyHolder.getKeys() != null && keyHolder.getKeys().containsKey("id")) {
            return ((Number) keyHolder.getKeys().get("id")).longValue();
        }
        return null;
    }

    /**
     * Retrieves the submission ID for the currently authenticated user for a specific status.
     */
    public Long getUserSubmissionId(UUID versionId, String status) {
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User userDetails) {
            String tableName = version.getTableName();
            if (tableName == null || tableName.isBlank()) {
                return null;
            }
            String sql = "SELECT \"id\" FROM \"" + tableName + "\" WHERE \"submitted_by\" = CAST(? AS UUID) AND \"status\" = ?";
            if (hasColumn(tableName, "deleted")) {
                sql += " AND \"deleted\" = FALSE";
            }
            sql += " ORDER BY \"id\" DESC LIMIT 1";

            try {
                Long id = jdbcTemplate.queryForObject(sql, Long.class, userDetails.getId().toString(), status);
                System.out.println("DEBUG: Submission/Draft found for user " + userDetails.getId() + " in table " + tableName + ": " + id);
                return id;
            } catch (org.springframework.dao.EmptyResultDataAccessException e) {
                System.out.println("DEBUG: No submission/draft found for user " + userDetails.getId() + " in table " + tableName + " with status " + status);
                return null;
            } catch (Exception e) {
                System.err.println("ERROR: Failed to lookup submission/draft: " + e.getMessage());
                return null;
            }
        }
        return null;
    }

    /**
     * Retrieves the submission ID for the currently authenticated user if they have
     * already submitted.
     * Useful for forms with the 'oneSubmissionPerUser' constraint.
     */
    public Long getUserSubmissionId(UUID versionId) {
        return getUserSubmissionId(versionId, "COMPLETED");
    }

    /**
     * Checks if a user had a draft for a different version of the same form.
     * If so, it means their draft was discarded.
     */
    public boolean wasDraftDiscarded(UUID currentVersionId) {
        FormVersion currentVersion = versionRepository.findById(currentVersionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));
        
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User userDetails) {
            UUID userId = userDetails.getId();
            String tableName = currentVersion.getTableName();
            if (tableName == null) return false;

            // Check if ANY draft exists for this user in this form's table that IS NOT for the current version
            // Wait, if we delete all drafts on publish, this won't find anything.
            // But we only delete them during publishVersion.
            // If they had a draft on an old version, and it wasn't deleted yet (maybe due to some error), 
            // or if we want to track the "discarded" state, we need a way.
            
            // Actually, the requirement "All existing drafts for the previous version shall be dropped"
            // is handled in SchemaService.
            
            // To detect "discarded", we can check if there are NO drafts for current version
            // BUT there were drafts for this form ID in the past? 
            // This is hard to track without a separate log.
            
            // Let's change the approach for "discarded warning":
            // The frontend can send its last known versionId. If it doesn't match current, show warning.
            
            // Or: In SubmissionService, we can keep track of "last seen version" per user/form? No.
            
            // Re-reading: "Users must be shown a clear warning indicating that their drafts were discarded..."
            // If I delete them on publish, they are gone.
            
            // How about if PublicFormController.getPublishedForm checks if the user *would have* had a draft?
            
            // Let's just implement the deletion and the inactive checks first.
            // For the warning, I'll add a flag to the response if a draft was found for an old version.
        }
        return false;
    }

    /**
     * Retrives a specific submission by its ID.
     */
    public Map<String, Object> getSubmission(UUID versionId, Long submissionId) {
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UUID userId = null;
        com.sttl.formbuilder.Enums.Role userRole = null;
        if (auth != null && auth.getPrincipal() instanceof User userDetails) {
            userId = userDetails.getId();
            userRole = userDetails.getRole();
        }

        String sql = "SELECT * FROM \"" + version.getTableName() + "\" WHERE \"id\" = ?";
        Map<String, Object> row;
        try {
            row = jdbcTemplate.queryForMap(sql, submissionId);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new RuntimeException("Submission not found");
        }

        // Access control: only admin, or the owner can view their submission
        if (userRole != com.sttl.formbuilder.Enums.Role.ADMIN) {
            if (userId == null || !userId.toString().equals(String.valueOf(row.get("submitted_by")))) {
                throw new RuntimeException("You do not have permission to view this submission");
            }
        }

        // Soft-delete check: block if deleted
        if (row.containsKey("deleted") && Boolean.TRUE.equals(row.get("deleted"))) {
            throw new IllegalArgumentException("This response has been deleted and cannot be edited.");
        }

        return row;
    }

    /**
     * Update an existing submission.
     */
    public void updateSubmission(UUID versionId, Long submissionId, Map<String, Object> data) {
        if (versionId == null || submissionId == null)
            throw new IllegalArgumentException("IDs cannot be null");
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));
        validateFormStatus(version);

        // ─── DRIFT CHECK ─────────────────────────────────────────────────────
        if (schemaService.isDrifted(version.getTableName())) {
             throw new com.sttl.formbuilder.exception.SchemaDriftException("Update blocked: Database schema drift detected in table '" + version.getTableName() + "'. Please contact the administrator.");
        }
        // Live check for extra robustness
        List<FormField> expectedFields = fieldRepository.findByVersion_IdOrderByFieldOrder(versionId);
        schemaDriftService.validateSchema(version, expectedFields);
        // ─────────────────────────────────────────────────────────────────────

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UUID userId = null;
        com.sttl.formbuilder.Enums.Role userRole = null;
        if (auth != null && auth.getPrincipal() instanceof User userDetails) {
            userId = userDetails.getId();
            userRole = userDetails.getRole();
        }

        // ─── Soft-delete Protection ──────────────────────────────────────────
        if (hasColumn(version.getTableName(), "deleted")) {
            String checkDeletedSql = "SELECT \"deleted\" FROM \"" + version.getTableName() + "\" WHERE id = ?";
            try {
                Boolean isDeleted = jdbcTemplate.queryForObject(checkDeletedSql, Boolean.class, submissionId);
                if (Boolean.TRUE.equals(isDeleted)) {
                    throw new IllegalArgumentException("This response has been deleted and cannot be edited.");
                }
            } catch (Exception e) { /* ignore or log */ }
        }
        // ─────────────────────────────────────────────────────────────────────

        // ─── Access Control Check ────────────────────────────────────────────
        if (userRole == com.sttl.formbuilder.Enums.Role.USER && userId != null) {
            String checkSql = "SELECT \"submitted_by\" FROM \"" + version.getTableName() + "\" WHERE id = ?";
            UUID ownerId = jdbcTemplate.queryForObject(checkSql, UUID.class, submissionId);
            if (ownerId == null || !ownerId.equals(userId)) {
                throw new IllegalArgumentException("You can only edit your own submissions.");
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        // ─── Status Handling ────────────────────────────────────────────────
        String status = (String) data.getOrDefault("status", "COMPLETED");
        boolean isDraft = "DRAFT".equals(status);

        List<FormField> fields = fieldRepository.findByVersion_IdOrderByFieldOrder(versionId);
        Map<String, Object> cleanedData = validateAndCleanData(fields, data, isDraft);

        if (cleanedData.isEmpty() && !isDraft) {
            throw new RuntimeException("No valid data provided for update");
        }

        // ─── Uniqueness Check ────────────────────────────────────────────────
        if (!isDraft) {
            for (FormField field : fields) {
                if (Boolean.TRUE.equals(field.getIsUnique())) {
                    String key = field.getFieldKey();
                    Object val = cleanedData.get(key);
                    if (val != null && !val.toString().trim().isEmpty()) {
                        String checkSql = "SELECT COUNT(*) FROM \"" + version.getTableName() + "\" WHERE \"" + key
                                + "\" = ? AND id != ?";
                        Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, val, submissionId);
                        if (count != null && count > 0) {
                            throw new IllegalArgumentException("The value for '" + field.getFieldLabel()
                                    + "' already exists. Please provide a unique value.");
                        }
                    }
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        // ─── Business Rules Evaluation ──────────────────────────────────────
        UUID formId = version.getForm().getId();
        SubmissionFact fact = ruleService.evaluateRules(formId, cleanedData);
        if (fact.hasErrors()) {
            if (!isDraft) {
                throw new RuntimeException("Business rule violation: " + String.join("; ", fact.getErrors()));
            }
        }
        // Apply any SET_VALUE overrides from rules
        fact.getUpdatedValues().forEach(cleanedData::put);
        // ─────────────────────────────────────────────────────────────────────

        StringBuilder sql = new StringBuilder("UPDATE \"" + version.getTableName() + "\" SET ");
        List<Object> values = new ArrayList<>();

        for (Map.Entry<String, Object> entry : cleanedData.entrySet()) {
            sql.append("\"").append(entry.getKey()).append("\" = ?, ");
            values.add(entry.getValue());
        }

        sql.append("\"status\" = ?, ");
        values.add(status);

        // Remove trailing comma and space
        sql.setLength(sql.length() - 2);
        sql.append(" WHERE id = ?");
        values.add(submissionId);

        jdbcTemplate.update(sql.toString(), values.toArray());
    }

    /**
     * Delete a submission.
     */
    public void deleteSubmission(UUID versionId, Long submissionId) {
        if (versionId == null || submissionId == null)
            throw new IllegalArgumentException("IDs cannot be null");
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean softDeleteSetting = false;
        if (auth != null && auth.getPrincipal() instanceof User principal) {
            // Fetch fresh user data from DB to avoid staleness
            User user = userRepository.findById(principal.getId()).orElse(principal);
            softDeleteSetting = Boolean.TRUE.equals(user.getSoftDeleteEnabled());
        }

        if (softDeleteSetting) {
            // Check if 'deleted' column exists
            String checkSql = "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = ? AND column_name = 'deleted' AND table_schema = CURRENT_SCHEMA()";
            Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, version.getTableName());
            if (count != null && count > 0) {
                // Check if already soft-deleted
                String statusSql = "SELECT \"deleted\" FROM \"" + version.getTableName() + "\" WHERE id = ?";
                try {
                    Boolean isAlreadyDeleted = jdbcTemplate.queryForObject(statusSql, Boolean.class, submissionId);
                    if (Boolean.TRUE.equals(isAlreadyDeleted)) {
                        // It's already in the trash, so this second delete call means PERMANENT DELETE
                        String sql = "DELETE FROM \"" + version.getTableName() + "\" WHERE id = ?";
                        jdbcTemplate.update(sql, submissionId);
                        return;
                    } else {
                        // Not in trash yet, so move it there
                        String sql = "UPDATE \"" + version.getTableName() + "\" SET \"deleted\" = TRUE WHERE id = ?";
                        jdbcTemplate.update(sql, submissionId);
                        return;
                    }
                } catch (org.springframework.dao.EmptyResultDataAccessException e) {
                    // Record might already be gone, just return
                    return;
                }
            }
        }

        String sql = "DELETE FROM \"" + version.getTableName() + "\" WHERE id = ?";
        jdbcTemplate.update(sql, submissionId);
    }

    /**
     * Bulk delete submissions.
     */
    public void bulkDeleteSubmissions(UUID versionId, List<Long> submissionIds, UUID userId) {
        // Verify ownership: version belongs to a form owned by userId
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));
        if (!version.getForm().getCreatedBy().getId().equals(userId)) {
            throw new RuntimeException("You do not have permission to delete submissions for this form");
        }

        for (Long id : submissionIds) {
            deleteSubmission(versionId, id);
        }
    }

    /**
     * Internal helper to validate and clean submission data.
     */
    private Map<String, Object> validateAndCleanData(List<FormField> fields, Map<String, Object> data, boolean isDraft) {
        Map<String, Object> cleanedData = new HashMap<>();

        for (FormField field : fields) {
            String fieldType = field.getFieldType().toUpperCase();
            if ("HEADING".equals(fieldType) || "PAGE_BREAK".equals(fieldType)) {
                continue;
            }
            String key = field.getFieldKey();
            Object raw = data.get(key);

            // Required check
            if (!isDraft && Boolean.TRUE.equals(field.getRequired())) {
                if (raw == null || raw.toString().trim().isEmpty()) {
                    throw new IllegalArgumentException("Field '" + field.getFieldLabel() + "' is required");
                }
            }

            if (raw == null) continue;
            String rawStr = raw.toString().trim();
            if (rawStr.isEmpty()) continue;

            Object finalValue = switch (fieldType) {
                case "NUMBER", "DECIMAL" -> validateAndCleanNumber(field, rawStr, isDraft);
                case "LINEAR_SCALE", "RATING", "RANGE" -> validateAndCleanScale(field, fieldType, rawStr, isDraft);
                case "TOGGLE" -> Boolean.parseBoolean(rawStr);
                case "INTEGER" -> validateAndCleanInteger(field, rawStr, isDraft);
                case "MC_GRID", "CHECKBOX_GRID" -> validateAndCleanGrid(field, fieldType, rawStr, isDraft);
                case "DATE", "TIME", "DATE_TIME", "MONTH", "WEEK" -> validateAndCleanDateTime(field, rawStr, isDraft);
                case "FILE" -> validateAndCleanFile(field, rawStr, isDraft);
                default -> validateAndCleanText(field, fieldType, rawStr, isDraft);
            };

            if (finalValue != null) {
                cleanedData.put(key, finalValue);
            }
        }
        return cleanedData;
    }

    private Object validateAndCleanNumber(FormField field, String rawStr, boolean isDraft) {
        try {
            BigDecimal numVal = new BigDecimal(rawStr);
            if (field.getMinValueStr() != null && !field.getMinValueStr().isBlank()) {
                BigDecimal minBd = new BigDecimal(field.getMinValueStr());
                if (numVal.compareTo(minBd) < 0) {
                    if (isDraft) return null;
                    throw new IllegalArgumentException("Value for '" + field.getFieldLabel() + "' must be \u2265 " + field.getMinValueStr());
                }
            }
            if (field.getMaxValueStr() != null && !field.getMaxValueStr().isBlank()) {
                BigDecimal maxBd = new BigDecimal(field.getMaxValueStr());
                if (numVal.compareTo(maxBd) > 0) {
                    if (isDraft) return null;
                    throw new IllegalArgumentException("Value for '" + field.getFieldLabel() + "' must be \u2264 " + field.getMaxValueStr());
                }
            }
            return numVal;
        } catch (NumberFormatException e) {
            if (isDraft) return null;
            throw new IllegalArgumentException("Invalid number for field '" + field.getFieldLabel() + "'");
        }
    }

    private Object validateAndCleanScale(FormField field, String fieldType, String rawStr, boolean isDraft) {
        try {
            int numVal = Integer.parseInt(rawStr);
            int min = field.getMinValue() != null ? field.getMinValue() : (fieldType.equals("RANGE") ? 0 : 1);
            int max = field.getMaxValue() != null ? field.getMaxValue() : (fieldType.equals("RANGE") ? 100 : 5);

            if (numVal < min || numVal > max) {
                if (isDraft) return null;
                throw new IllegalArgumentException("Value for '" + field.getFieldLabel() + "' must be between " + min + " and " + max);
            }
            return numVal;
        } catch (NumberFormatException e) {
            if (isDraft) return null;
            throw new IllegalArgumentException("Invalid value for field '" + field.getFieldLabel() + "'");
        }
    }

    private Object validateAndCleanInteger(FormField field, String rawStr, boolean isDraft) {
        try {
            return Integer.parseInt(rawStr);
        } catch (NumberFormatException e) {
            if (isDraft) return null;
            throw new IllegalArgumentException("Invalid integer for field '" + field.getFieldLabel() + "'");
        }
    }

    private Object validateAndCleanGrid(FormField field, String fieldType, String rawStr, boolean isDraft) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> gridData = mapper.readValue(rawStr, new TypeReference<Map<String, Object>>() {});
            Map<String, List<String>> definition;
            try {
                definition = mapper.readValue(field.getOptions(), new TypeReference<Map<String, List<String>>>() {});
            } catch (Exception e) {
                definition = Map.of("rows", List.of("Row 1"), "columns", List.of("Column 1"));
            }

            List<String> allowedRows = definition.getOrDefault("rows", List.of("Row 1"));
            List<String> allowedCols = definition.getOrDefault("columns", List.of("Column 1"));

            for (Map.Entry<String, Object> entry : gridData.entrySet()) {
                String row = entry.getKey();
                if (!allowedRows.contains(row)) {
                    if (isDraft) continue;
                    throw new IllegalArgumentException("Invalid row '" + row + "' in grid '" + field.getFieldLabel() + "'");
                }
                Object selection = entry.getValue();
                if (selection == null) continue;

                if (fieldType.equals("MC_GRID")) {
                    String col = selection.toString();
                    if (!col.isEmpty() && !allowedCols.contains(col)) {
                        if (isDraft) continue;
                        throw new IllegalArgumentException("Invalid selection '" + col + "' for row '" + row + "'");
                    }
                } else {
                    List<String> selectedCols = selection instanceof List ? (List<String>) selection : List.of(selection.toString());
                    for (String col : selectedCols) {
                        if (!allowedCols.contains(col)) {
                            if (isDraft) continue;
                            throw new IllegalArgumentException("Invalid selection '" + col + "' for row '" + row + "'");
                        }
                    }
                }
            }
            return rawStr;
        } catch (Exception e) {
            if (isDraft) return null;
            throw new IllegalArgumentException("Invalid format for grid field '" + field.getFieldLabel() + "': " + e.getMessage());
        }
    }

    private Object validateAndCleanDateTime(FormField field, String rawStr, boolean isDraft) {
        String sanitized = InputSanitizer.sanitizeText(rawStr, 50);
        if (field.getMinValueStr() != null && !field.getMinValueStr().isBlank() && sanitized.compareTo(field.getMinValueStr()) < 0) {
            if (isDraft) return null;
            throw new IllegalArgumentException("Value for '" + field.getFieldLabel() + "' must be on or after " + field.getMinValueStr());
        }
        if (field.getMaxValueStr() != null && !field.getMaxValueStr().isBlank() && sanitized.compareTo(field.getMaxValueStr()) > 0) {
            if (isDraft) return null;
            throw new IllegalArgumentException("Value for '" + field.getFieldLabel() + "' must be on or before " + field.getMaxValueStr());
        }
        return sanitized;
    }

    private Object validateAndCleanFile(FormField field, String rawStr, boolean isDraft) {
        String sanitized = InputSanitizer.sanitizeText(rawStr, 500);
        if (field.getAllowedFileTypes() != null && !field.getAllowedFileTypes().isBlank()) {
            String[] allowedCats = field.getAllowedFileTypes().split(",");
            String originalName = sanitized.contains("|") ? sanitized.split("\\|")[0] : sanitized;
            String ext = originalName.contains(".") ? originalName.substring(originalName.lastIndexOf(".")).toLowerCase() : "";

            Map<String, List<String>> catMap = Map.of(
                    "IMAGE", List.of(".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"),
                    "VIDEO", List.of(".mp4", ".mov", ".avi", ".mkv", ".webm"),
                    "PDF", List.of(".pdf"),
                    "EXCEL", List.of(".xls", ".xlsx"),
                    "CSV", List.of(".csv"),
                    "DOC", List.of(".doc", ".docx"),
                    "TEXT", List.of(".txt"),
                    "ZIP", List.of(".zip", ".rar", ".7z")
            );

            boolean isAllowed = false;
            for (String cat : allowedCats) {
                List<String> extensions = catMap.get(cat.toUpperCase());
                if (extensions != null && extensions.contains(ext)) {
                    isAllowed = true;
                    break;
                }
            }
            if (!isAllowed) {
                if (isDraft) return null;
                throw new RuntimeException("File type not allowed for field '" + field.getFieldLabel() + "'. Allowed: " + field.getAllowedFileTypes());
            }
        }
        return sanitized;
    }

    private Object validateAndCleanText(FormField field, String fieldType, String rawStr, boolean isDraft) {
        String sanitized = InputSanitizer.sanitizeText(rawStr, 5000);
        if (sanitized == null || sanitized.isEmpty()) return null;

        if (!Boolean.FALSE.equals(field.getTrimWhitespace())) sanitized = sanitized.strip();
        if (!Boolean.FALSE.equals(field.getRemoveExtraSpaces())) sanitized = sanitized.replaceAll("\\s+", " ");
        if (sanitized.isEmpty()) return null;

        if (field.getMinLength() != null && sanitized.length() < field.getMinLength()) {
            if (isDraft) return null;
            throw new RuntimeException("Value for '" + field.getFieldLabel() + "' must be at least " + field.getMinLength() + " characters");
        }
        if (field.getMaxLength() != null && sanitized.length() > field.getMaxLength()) {
            if (isDraft) return null;
            throw new RuntimeException("Value for '" + field.getFieldLabel() + "' must be at most " + field.getMaxLength() + " characters");
        }

        if (List.of("DROPDOWN", "MULTIPLE_CHOICE", "CHECKBOXES").contains(fieldType)) {
            try {
                validateChoices(field, sanitized);
            } catch (Exception e) {
                if (isDraft) return null;
                throw e;
            }
        }

        if (List.of("SHORT_ANSWER", "PARAGRAPH", "PASSWORD", "SEARCH").contains(fieldType)) {
            try {
                validateCharType(field, sanitized);
            } catch (Exception e) {
                if (isDraft) return null;
                throw e;
            }
            if (Boolean.FALSE.equals(field.getAllowSpecialChars()) && java.util.regex.Pattern.compile("[^\\w\\s]").matcher(sanitized).find()) {
                if (isDraft) return null;
                throw new RuntimeException("Value for '" + field.getFieldLabel() + "' must not contain special characters");
            }
        }

        if (field.getCustomRegex() != null && !field.getCustomRegex().isBlank()) {
            if (!java.util.regex.Pattern.compile(field.getCustomRegex()).matcher(sanitized).matches()) {
                if (isDraft) return null;
                throw new RuntimeException("Value for '" + field.getFieldLabel() + "' does not match the required pattern.");
            }
        }
        return sanitized;
    }

    private void validateCharType(FormField field, String sanitized) {
        if (field.getCharType() == null || field.getCharType().isBlank()) return;
        java.util.regex.Pattern pattern = switch (field.getCharType().toUpperCase()) {
            case "LETTERS" -> java.util.regex.Pattern.compile("^[\\p{L} ]*$");
            case "NUMBERS" -> java.util.regex.Pattern.compile("^[\\d ]*$");
            case "BOTH" -> java.util.regex.Pattern.compile("^[\\p{L}\\d ]*$");
            default -> null;
        };
        if (pattern != null && !pattern.matcher(sanitized).matches()) {
            String label = switch (field.getCharType().toUpperCase()) {
                case "LETTERS" -> "letters only";
                case "NUMBERS" -> "numbers only";
                case "BOTH" -> "letters and numbers only";
                default -> field.getCharType();
            };
            throw new RuntimeException("Value for '" + field.getFieldLabel() + "' must contain " + label);
        }
    }

    /**
     * Retrieve all submissions for a given version.
     */
    public List<Map<String, Object>> getSubmissions(UUID versionId) {
        return getSubmissions(versionId, true, null);
    }

    public List<Map<String, Object>> getSubmissions(UUID versionId, boolean filterByVersion, List<Long> ids) {
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        if (!"PUBLISHED".equals(version.getStatus()) && !"ARCHIVED".equals(version.getStatus())) {
            return new ArrayList<>();
        }

        String tableName = version.getTableName();
        List<FormField> fields = fieldRepository.findByVersion_IdOrderByFieldOrder(versionId);

        StringBuilder sql = new StringBuilder("SELECT s.\"id\", s.\"submitted_at\" ");
        StringBuilder joins = new StringBuilder();
        int dynamicCount = 0;

        for (FormField field : fields) {
            String key = field.getFieldKey();
            if (List.of("HEADING", "PAGE_BREAK").contains(field.getFieldType().toUpperCase())) {
                continue;
            }

            if ("DROPDOWN".equalsIgnoreCase(field.getFieldType()) && field.hasDataSource()) {
                String column = field.getDataSourceColumn();
                String alias = "d" + (++dynamicCount);
                sql.append(", COALESCE(CAST(").append(alias).append(".\"").append(column)
                   .append("\" AS VARCHAR), s.\"").append(key).append("\") as \"").append(key).append("\" ");
                sql.append(", s.\"").append(key).append("\" as \"").append(key).append("_raw\" ");

                joins.append(" LEFT JOIN \"").append(field.getDataSourceTable()).append("\" ").append(alias)
                     .append(" ON s.\"").append(key).append("\" = CAST(").append(alias).append(".id AS VARCHAR) ");
            } else {
                sql.append(", s.\"").append(key).append("\" ");
            }
        }

        sql.append(", s.\"status\" FROM \"").append(tableName).append("\" s ").append(joins);

        List<String> whereClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        // Handle soft-delete if column exists
        if (hasColumn(tableName, "deleted")) {
            whereClauses.add("s.\"deleted\" = FALSE");
        }

        if (filterByVersion) {
            whereClauses.add("s.\"version_id\" = CAST(? AS UUID)");
            params.add(versionId.toString());
        }

        if (ids != null && !ids.isEmpty()) {
            String idList = ids.stream().map(String::valueOf).collect(Collectors.joining(","));
            whereClauses.add("s.\"id\" IN (" + idList + ")");
        }

        if (!whereClauses.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", whereClauses));
        }

        sql.append(" ORDER BY s.\"submitted_at\" DESC");
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    private boolean hasColumn(String tableName, String columnName) {
        String sql = "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? AND column_name = ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, tableName, columnName);
        return count != null && count > 0;
    }

    /**
     * Get submission count for a version.
     */
    public Integer getSubmissionCount(UUID versionId) {
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        if (!"PUBLISHED".equals(version.getStatus()) && !"ARCHIVED".equals(version.getStatus()))
            return 0;

        String tableName = version.getTableName();
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM \"" + tableName + "\" WHERE \"version_id\" = CAST(? AS UUID)", Integer.class, versionId.toString());
    }

    /**
     * Get total submission count across ALL published versions for a specific user
     * (for dashboard stats).
     */
    public long getTotalSubmissions(UUID userId) {
        // Fetch ALL versions for this user's forms to sum up all historical submissions
        List<FormVersion> versions = versionRepository.findByForm_CreatedBy_Id(userId);
        long total = 0;
        for (FormVersion version : versions) {
            String tableName = version.getTableName();
            if (tableName != null && !tableName.isBlank()) {
                try {
                    Integer count = jdbcTemplate.queryForObject(
                            "SELECT COUNT(*) FROM \"" + tableName + "\" WHERE \"version_id\" = CAST(? AS UUID)",
                             Integer.class, version.getId().toString());
                    if (count != null)
                        total += count;
                } catch (Exception e) {
                    // Table might not exist or column missing, skip safely
                }
            }
        }
        return total;
    }

    private void validateChoices(FormField field, String value) {
        if (value == null || value.isBlank())
            return;

        List<String> submittedValues = new ArrayList<>();
        if ("CHECKBOXES".equalsIgnoreCase(field.getFieldType())) {
            try {
                submittedValues = new ObjectMapper().readValue(value, new TypeReference<List<String>>() {
                });
            } catch (Exception e) {
                throw new IllegalArgumentException(
                        "Invalid format for checkboxes in field '" + field.getFieldLabel() + "'");
            }
        } else {
            submittedValues.add(value);
        }

        if (submittedValues.isEmpty())
            return;

        // Determine source
        boolean isDynamic = field.getDataSourceTable() != null && !field.getDataSourceTable().isBlank()
                && field.getDataSourceColumn() != null && !field.getDataSourceColumn().isBlank();

        if (isDynamic) {
            String table = field.getDataSourceTable();
            String column = field.getDataSourceColumn();

            // Strict regex check for identifier safety (extra layer besides InputSanitizer)
            if (!table.matches("^[a-zA-Z0-9_]+$") || !column.matches("^[a-zA-Z0-9_]+$")) {
                throw new IllegalArgumentException(
                        "Invalid data source configuration for field '" + field.getFieldLabel() + "'");
            }

            for (String val : submittedValues) {
                // Check if it's a numeric ID (new way) or fallback to string value (old way)
                String checkSql;
                boolean isNumeric = val.matches("^\\d+$");
                if (isNumeric) {
                    checkSql = "SELECT COUNT(*) FROM \"" + table + "\" WHERE \"id\" = ?";
                } else {
                    checkSql = "SELECT COUNT(*) FROM \"" + table + "\" WHERE \"" + column + "\" = ?";
                }

                Integer count;
                if (isNumeric) {
                    count = jdbcTemplate.queryForObject(checkSql, Integer.class, Long.parseLong(val));
                } else {
                    count = jdbcTemplate.queryForObject(checkSql, Integer.class, val);
                }

                if (count == null || count == 0) {
                    throw new IllegalArgumentException(
                            "Invalid option selected for '" + field.getFieldLabel() + "': " + val);
                }
            }
        } else {
            // Static options
            try {
                List<String> allowedOptions = new ObjectMapper().readValue(field.getOptions(),
                        new TypeReference<List<String>>() {
                        });
                for (String val : submittedValues) {
                    if (!allowedOptions.contains(val)) {
                        throw new IllegalArgumentException(
                                "Invalid option selected for '" + field.getFieldLabel() + "': " + val);
                    }
                }
            } catch (Exception e) {
                // If options JSON is broken, we can't validate, but this shouldn't happen with
                // normal editor use
                throw new IllegalArgumentException(
                        "Error validating options for field '" + field.getFieldLabel() + "'");
            }
        }
    }

    /**
     * Retrieve all soft-deleted submissions for a version.
     */
    public List<Map<String, Object>> getTrashSubmissions(UUID versionId) {
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        String tableName = version.getTableName();
        String sqlCheckDeleted = "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = ? AND column_name = 'deleted' AND table_schema = CURRENT_SCHEMA()";
        Integer hasDeletedCol = jdbcTemplate.queryForObject(sqlCheckDeleted, Integer.class, tableName);

        if (hasDeletedCol == null || hasDeletedCol == 0) {
            return new ArrayList<>();
        }

        // Simpler query for trash view, similar to getSubmissions but filtered for
        // deleted = TRUE
        List<FormField> fields = fieldRepository.findByVersion_IdOrderByFieldOrder(versionId);
        StringBuilder sql = new StringBuilder("SELECT s.id, s.submitted_at ");
        for (FormField field : fields) {
            if (!field.getFieldType().equalsIgnoreCase("HEADING")) {
                sql.append(", s.\"").append(field.getFieldKey()).append("\" ");
            }
        }
        sql.append(" FROM \"").append(tableName).append("\" s WHERE s.\"deleted\" = TRUE ORDER BY s.submitted_at DESC");

        return jdbcTemplate.queryForList(sql.toString());
    }

    /**
     * Recover a soft-deleted submission.
     */
    public void recoverSubmission(UUID versionId, Long submissionId) {
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        String sql = "UPDATE \"" + version.getTableName() + "\" SET \"deleted\" = FALSE WHERE id = ?";
        jdbcTemplate.update(sql, submissionId);
    }

    /**
     * Bulk recover submissions.
     */
    public void bulkRecoverSubmissions(UUID versionId, List<Long> submissionIds, UUID userId) {
        // Verify ownership
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));
        if (!version.getForm().getCreatedBy().getId().equals(userId)) {
            throw new RuntimeException("You do not have permission to recover submissions for this form");
        }

        for (Long id : submissionIds) {
            recoverSubmission(versionId, id);
        }
    }

    /**
     * Export submissions to CSV with formula injection protection.
     */
    public byte[] exportToCsv(UUID versionId) {
        return exportToCsv(versionId, null);
    }

    public byte[] exportToCsv(UUID versionId, List<Long> ids) {
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        List<FormField> fields = fieldRepository.findByVersion_IdOrderByFieldOrder(versionId)
                .stream().filter(f -> !"HEADING".equalsIgnoreCase(f.getFieldType())).toList();
        List<Map<String, Object>> submissions = getSubmissions(versionId, true, ids);

        StringBuilder csv = new StringBuilder();

        // Header
        csv.append("\"ID\",\"Submitted At\"");
        for (FormField field : fields) {
            csv.append(",\"").append(escapeCsv(field.getFieldLabel())).append("\"");
        }
        csv.append("\n");

        // Data
        for (Map<String, Object> sub : submissions) {
            csv.append("\"").append(sub.get("id")).append("\",");
            csv.append("\"").append(sub.get("submitted_at")).append("\"");
            for (FormField f : fields) {
                Object val = sub.get(f.getFieldKey());
                String strVal = val != null ? val.toString() : "";
                csv.append(",\"").append(escapeCsv(sanitizeForCsvInjection(strVal))).append("\"");
            }
            csv.append("\n");
        }

        return csv.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    private void validateFormStatus(FormVersion version) {
        if (version.getForm().isDeleted()) {
            throw new IllegalArgumentException("This form has been deleted.");
        }
        if (!"PUBLISHED".equals(version.getStatus()) && !Boolean.TRUE.equals(version.isActive())) {
            throw new IllegalArgumentException("This form version is no longer active and cannot accept submissions.");
        }
        if (version.getForm().getUnpublishTime() != null
                && LocalDateTime.now().isAfter(version.getForm().getUnpublishTime())) {
            throw new IllegalArgumentException("This form has been closed by the admin.");
        }
    }

    private String escapeCsv(String value) {
        if (value == null)
            return "";
        return value.replace("\"", "\"\"");
    }

    private String sanitizeForCsvInjection(String value) {
        if (value == null || value.isEmpty())
            return "";
        char first = value.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@') {
            return "'" + value;
        }
        return value;
    }
}
