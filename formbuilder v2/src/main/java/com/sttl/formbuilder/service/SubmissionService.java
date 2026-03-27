package com.sttl.formbuilder.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.UUID;
import java.time.LocalDateTime;

import com.sttl.formbuilder.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import com.sttl.formbuilder.entity.User;
import com.sttl.formbuilder.entity.FormField;
import com.sttl.formbuilder.entity.FormVersion;
import com.sttl.formbuilder.model.SubmissionFact;
import com.sttl.formbuilder.repository.FormFieldRepository;
import com.sttl.formbuilder.repository.FormVersionRepository;
import com.sttl.formbuilder.util.InputSanitizer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import java.sql.PreparedStatement;
import java.sql.Statement;

@Service
public class SubmissionService {

    private final JdbcTemplate jdbcTemplate;
    private final FormVersionRepository versionRepository;
    private final FormFieldRepository fieldRepository;
    private final DroolsRuleService droolsRuleService;
    private final UserRepository userRepository;

    public SubmissionService(JdbcTemplate jdbcTemplate,
            FormVersionRepository versionRepository,
            FormFieldRepository fieldRepository,
            DroolsRuleService droolsRuleService,
            UserRepository userRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.versionRepository = versionRepository;
        this.fieldRepository = fieldRepository;
        this.droolsRuleService = droolsRuleService;
        this.userRepository = userRepository;
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

        if (!"PUBLISHED".equals(version.getStatus()) && !Boolean.TRUE.equals(version.isActive())) {
            throw new IllegalArgumentException("This form is not published yet");
        }

        if (version.getForm().isDeleted()) {
            throw new IllegalArgumentException("This form has been deleted.");
        }

        // ─── Unpublish Time Check ────────────────────────────────────────────
        if (version.getForm().getUnpublishTime() != null
                && LocalDateTime.now().isAfter(version.getForm().getUnpublishTime())) {
            throw new IllegalArgumentException("This form has been closed by the admin.");
        }
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
        if (Boolean.TRUE.equals(version.getForm().getOneSubmissionPerUser())
                && userRole == com.sttl.formbuilder.Enums.Role.USER && userId != null) {
            String checkSql = "SELECT COUNT(*) FROM \"" + version.getTableName()
                    + "\" WHERE \"submitted_by\" = CAST(? AS UUID)";
            Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, userId.toString());
            if (count != null && count > 0) {
                throw new IllegalArgumentException("You have already submitted this form.");
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        List<FormField> fields = fieldRepository.findByVersion_IdOrderByFieldOrder(versionId);
        Map<String, Object> cleanedData = validateAndCleanData(fields, data);

        if (cleanedData.isEmpty()) {
            throw new IllegalArgumentException("No valid data provided");
        }

        // ─── Uniqueness Check ────────────────────────────────────────────────
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
        // ─────────────────────────────────────────────────────────────────────

        // ─── Drools Business Rules Evaluation ────────────────────────────────
        UUID formId = version.getForm().getId();
        SubmissionFact fact = droolsRuleService.evaluateRules(formId, cleanedData);
        if (fact.hasErrors()) {
            throw new RuntimeException("Business rule violation: " + String.join("; ", fact.getErrors()));
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
     * Retrieves the submission ID for the currently authenticated user if they have
     * already submitted.
     * Useful for forms with the 'oneSubmissionPerUser' constraint.
     */
    public Long getUserSubmissionId(UUID versionId) {
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User userDetails) {
            if (userDetails.getRole() == com.sttl.formbuilder.Enums.Role.USER) {
                String tableName = version.getTableName();
                if (tableName == null || tableName.isBlank()) {
                    return null;
                }
                String sql = "SELECT \"id\" FROM \"" + tableName + "\" WHERE \"submitted_by\" = CAST(? AS UUID) LIMIT 1";
                try {
                    return jdbcTemplate.queryForObject(sql, Long.class, userDetails.getId().toString());
                } catch (org.springframework.dao.EmptyResultDataAccessException e) {
                    return null;
                } catch (Exception e) {
                    System.err.println("WARNING: Could not check existing submission for version " + versionId 
                        + " on table " + tableName + ". Error: " + e.getMessage());
                    return null;
                }
            }
        }
        return null;
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

        if (version.getForm().isDeleted()) {
            throw new IllegalArgumentException("This form has been deleted.");
        }

        // ─── Unpublish Time Check ────────────────────────────────────────────
        if (version.getForm().getUnpublishTime() != null
                && LocalDateTime.now().isAfter(version.getForm().getUnpublishTime())) {
            throw new IllegalArgumentException("This form has been closed by the admin.");
        }
        // ─────────────────────────────────────────────────────────────────────

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UUID userId = null;
        com.sttl.formbuilder.Enums.Role userRole = null;
        if (auth != null && auth.getPrincipal() instanceof User userDetails) {
            userId = userDetails.getId();
            userRole = userDetails.getRole();
        }

        // ─── Access Control Check ────────────────────────────────────────────
        if (userRole == com.sttl.formbuilder.Enums.Role.USER && userId != null) {
            String checkSql = "SELECT \"submitted_by\" FROM \"" + version.getTableName() + "\" WHERE id = ?";
            UUID ownerId = jdbcTemplate.queryForObject(checkSql, UUID.class, submissionId);
            if (ownerId == null || !ownerId.equals(userId)) {
                throw new IllegalArgumentException("You can only edit your own submissions.");
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        List<FormField> fields = fieldRepository.findByVersion_IdOrderByFieldOrder(versionId);
        Map<String, Object> cleanedData = validateAndCleanData(fields, data);

        if (cleanedData.isEmpty()) {
            throw new RuntimeException("No valid data provided for update");
        }

        // ─── Uniqueness Check ────────────────────────────────────────────────
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
        // ─────────────────────────────────────────────────────────────────────

        StringBuilder sql = new StringBuilder("UPDATE \"" + version.getTableName() + "\" SET ");
        List<Object> values = new ArrayList<>();

        for (Map.Entry<String, Object> entry : cleanedData.entrySet()) {
            sql.append("\"").append(entry.getKey()).append("\" = ?, ");
            values.add(entry.getValue());
        }

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
    private Map<String, Object> validateAndCleanData(List<FormField> fields, Map<String, Object> data) {
        Map<String, Object> cleanedData = new HashMap<>();

        for (FormField field : fields) {
            String fieldType = field.getFieldType().toUpperCase();
            if ("HEADING".equals(fieldType) || "PAGE_BREAK".equals(fieldType)) {
                continue;
            }
            String key = field.getFieldKey();
            Object raw = data.get(key);

            // Required check
            if (Boolean.TRUE.equals(field.getRequired())) {
                if (raw == null || raw.toString().trim().isEmpty()) {
                    throw new IllegalArgumentException("Field '" + field.getFieldLabel() + "' is required");
                }
            }

            if (raw == null)
                continue;
            String rawStr = raw.toString().trim();
            if (rawStr.isEmpty())
                continue;

            Object finalValue;

            switch (fieldType) {
                case "NUMBER", "DECIMAL" -> {
                    try {
                        BigDecimal numVal = new BigDecimal(rawStr);
                        if (field.getMinValueStr() != null && !field.getMinValueStr().isBlank()) {
                            BigDecimal minBd = new BigDecimal(field.getMinValueStr());
                            if (numVal.compareTo(minBd) < 0)
                                throw new IllegalArgumentException(
                                        "Value for '" + field.getFieldLabel() + "' must be \u2265 "
                                                + field.getMinValueStr());
                        }
                        if (field.getMaxValueStr() != null && !field.getMaxValueStr().isBlank()) {
                            BigDecimal maxBd = new BigDecimal(field.getMaxValueStr());
                            if (numVal.compareTo(maxBd) > 0)
                                throw new IllegalArgumentException(
                                        "Value for '" + field.getFieldLabel() + "' must be \u2264 "
                                                + field.getMaxValueStr());
                        }
                        finalValue = numVal;
                    } catch (NumberFormatException e) {
                        throw new IllegalArgumentException("Invalid number for field '" + field.getFieldLabel() + "'");
                    }
                }
                case "LINEAR_SCALE", "RATING", "RANGE" -> {
                    try {
                        int numVal = Integer.parseInt(rawStr);
                        int min = field.getMinValue() != null ? field.getMinValue()
                                : (fieldType.equals("RANGE") ? 0 : 1);
                        int max = field.getMaxValue() != null ? field.getMaxValue()
                                : (fieldType.equals("RANGE") ? 100 : 5);

                        if (numVal < min || numVal > max) {
                            throw new IllegalArgumentException(
                                    "Value for '" + field.getFieldLabel() + "' must be between " + min + " and " + max);
                        }
                        finalValue = numVal;
                    } catch (NumberFormatException e) {
                        throw new IllegalArgumentException("Invalid value for field '" + field.getFieldLabel() + "'");
                    }
                }
                case "TOGGLE" -> {
                    finalValue = Boolean.parseBoolean(rawStr);
                }
                case "INTEGER" -> {

                    try {
                        finalValue = Integer.parseInt(rawStr);
                    } catch (NumberFormatException e) {
                        throw new IllegalArgumentException("Invalid integer for field '" + field.getFieldLabel() + "'");
                    }
                }
                case "MC_GRID", "CHECKBOX_GRID" -> {
                    // Expecting JSON: {"Row 1": "Col A"} or {"Row 1": ["Col A", "Col B"]}
                    try {
                        Map<String, Object> gridData = new ObjectMapper().readValue(rawStr,
                                new TypeReference<Map<String, Object>>() {
                                });

                        // Parse rows/cols from field options: {"rows": [...], "columns": [...]}
                        List<String> allowedRows;
                        List<String> allowedCols;
                        try {
                            Map<String, List<String>> definition = new ObjectMapper().readValue(field.getOptions(),
                                    new TypeReference<Map<String, List<String>>>() {
                                    });
                            allowedRows = definition.get("rows");
                            allowedCols = definition.get("columns");
                        } catch (Exception e) {
                            // Fallback for malformed or legacy data
                            allowedRows = List.of("Row 1");
                            allowedCols = List.of("Column 1");
                        }

                        if (allowedRows == null)
                            allowedRows = List.of("Row 1");
                        if (allowedCols == null)
                            allowedCols = List.of("Column 1");

                        for (Map.Entry<String, Object> entry : gridData.entrySet()) {
                            String row = entry.getKey();
                            if (!allowedRows.contains(row)) {
                                throw new IllegalArgumentException(
                                        "Invalid row '" + row + "' in grid '" + field.getFieldLabel() + "'");
                            }

                            Object selection = entry.getValue();
                            if (selection == null)
                                continue;

                            if (fieldType.equals("MC_GRID")) {
                                String col = selection.toString();
                                if (!col.isEmpty() && !allowedCols.contains(col)) {
                                    throw new IllegalArgumentException(
                                            "Invalid selection '" + col + "' for row '" + row + "'");
                                }
                            } else {
                                // CHECKBOX_GRID
                                List<String> selectedCols = new ArrayList<>();
                                if (selection instanceof List) {
                                    selectedCols = (List<String>) selection;
                                } else if (selection instanceof String) {
                                    selectedCols.add(selection.toString());
                                }

                                for (String col : selectedCols) {
                                    if (!allowedCols.contains(col)) {
                                        throw new IllegalArgumentException(
                                                "Invalid selection '" + col + "' for row '" + row + "'");
                                    }
                                }
                            }
                        }
                        finalValue = rawStr; // Store as JSON string
                    } catch (Exception e) {
                        throw new IllegalArgumentException(
                                "Invalid format for grid field '" + field.getFieldLabel() + "': " + e.getMessage());
                    }
                }
                case "DATE", "TIME", "DATE_TIME", "MONTH", "WEEK" -> {
                    String sanitized;
                    try {
                        sanitized = InputSanitizer.sanitizeText(rawStr, 50);
                    } catch (RuntimeException e) {
                        throw new RuntimeException("Field '" + field.getFieldLabel() + "' " + e.getMessage());
                    }
                    if (field.getMinValueStr() != null && !field.getMinValueStr().isBlank()
                            && sanitized.compareTo(field.getMinValueStr()) < 0)
                        throw new IllegalArgumentException(
                                "Value for '" + field.getFieldLabel() + "' must be on or after "
                                        + field.getMinValueStr());
                    if (field.getMaxValueStr() != null && !field.getMaxValueStr().isBlank()
                            && sanitized.compareTo(field.getMaxValueStr()) > 0)
                        throw new IllegalArgumentException(
                                "Value for '" + field.getFieldLabel() + "' must be on or before "
                                        + field.getMaxValueStr());
                    finalValue = sanitized;
                }
                case "FILE" -> {
                    String sanitized;
                    try {
                        sanitized = InputSanitizer.sanitizeText(rawStr, 500);
                    } catch (RuntimeException e) {
                        throw new RuntimeException("Field '" + field.getFieldLabel() + "' " + e.getMessage());
                    }
                    // rawStr is expected to be "originalName|savedName"
                    if (field.getAllowedFileTypes() != null && !field.getAllowedFileTypes().isBlank()) {
                        String[] allowedCats = field.getAllowedFileTypes().split(",");
                        String originalName = sanitized.contains("|") ? sanitized.split("\\|")[0] : sanitized;
                        String ext = originalName.contains(".")
                                ? originalName.substring(originalName.lastIndexOf(".")).toLowerCase()
                                : "";

                        Map<String, List<String>> catMap = Map.of(
                                "IMAGE", List.of(".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"),
                                "VIDEO", List.of(".mp4", ".mov", ".avi", ".mkv", ".webm"),
                                "PDF", List.of(".pdf"),
                                "EXCEL", List.of(".xls", ".xlsx"),
                                "CSV", List.of(".csv"),
                                "DOC", List.of(".doc", ".docx"),
                                "TEXT", List.of(".txt"),
                                "ZIP", List.of(".zip", ".rar", ".7z"));

                        boolean isAllowed = false;
                        for (String cat : allowedCats) {
                            List<String> extensions = catMap.get(cat.toUpperCase());
                            if (extensions != null && extensions.contains(ext)) {
                                isAllowed = true;
                                break;
                            }
                        }

                        if (!isAllowed) {
                            throw new RuntimeException("File type not allowed for field '" + field.getFieldLabel()
                                    + "'. Allowed: " + field.getAllowedFileTypes());
                        }
                    }
                    finalValue = sanitized;
                }
                default -> {
                    String sanitized;
                    try {
                        sanitized = InputSanitizer.sanitizeText(rawStr, 5000);
                    } catch (RuntimeException e) {
                        throw new RuntimeException("Field '" + field.getFieldLabel() + "' " + e.getMessage());
                    }
                    if (sanitized == null || sanitized.isEmpty())
                        continue;

                    if (!Boolean.FALSE.equals(field.getTrimWhitespace()))
                        sanitized = sanitized.strip();
                    if (!Boolean.FALSE.equals(field.getRemoveExtraSpaces()))
                        sanitized = sanitized.replaceAll("\\s+", " ");
                    if (sanitized.isEmpty())
                        continue;

                    if (field.getMinLength() != null && sanitized.length() < field.getMinLength())
                        throw new RuntimeException("Value for '" + field.getFieldLabel() + "' must be at least "
                                + field.getMinLength() + " characters");
                    if (field.getMaxLength() != null && sanitized.length() > field.getMaxLength())
                        throw new RuntimeException("Value for '" + field.getFieldLabel() + "' must be at most "
                                + field.getMaxLength() + " characters");

                    // Choice Validation for DROPDOWN, MULTIPLE_CHOICE, CHECKBOXES
                    if ("DROPDOWN".equals(fieldType) || "MULTIPLE_CHOICE".equals(fieldType)
                            || "CHECKBOXES".equals(fieldType)) {
                        validateChoices(field, sanitized);
                    }

                    boolean isFullText = List.of("SHORT_ANSWER", "PARAGRAPH", "PASSWORD", "SEARCH").contains(fieldType);
                    if (isFullText) {
                        if (field.getCharType() != null && !field.getCharType().isBlank()) {
                            java.util.regex.Pattern charPattern = switch (field.getCharType().toUpperCase()) {
                                case "LETTERS" -> java.util.regex.Pattern.compile("^[\\p{L} ]*$");
                                case "NUMBERS" -> java.util.regex.Pattern.compile("^[\\d ]*$");
                                case "BOTH" -> java.util.regex.Pattern.compile("^[\\p{L}\\d ]*$");
                                default -> null;
                            };
                            if (charPattern != null && !charPattern.matcher(sanitized).matches()) {
                                String allowed = switch (field.getCharType().toUpperCase()) {
                                    case "LETTERS" -> "letters only";
                                    case "NUMBERS" -> "numbers only";
                                    case "BOTH" -> "letters and numbers only";
                                    default -> field.getCharType();
                                };
                                throw new RuntimeException(
                                        "Value for '" + field.getFieldLabel() + "' must contain " + allowed);
                            }
                        }
                        if (Boolean.FALSE.equals(field.getAllowSpecialChars())
                                && java.util.regex.Pattern.compile("[^\\w\\s]").matcher(sanitized).find())
                            throw new RuntimeException(
                                    "Value for '" + field.getFieldLabel() + "' must not contain special characters");
                    }

                    if (field.getCustomRegex() != null && !field.getCustomRegex().isBlank()) {
                        try {
                            if (!java.util.regex.Pattern.compile(field.getCustomRegex()).matcher(sanitized).matches())
                                throw new RuntimeException("Value for '" + field.getFieldLabel()
                                        + "' does not match the required pattern. Note: your regex must be aligned with your other settings.");
                        } catch (Exception e) {
                            throw new RuntimeException("Invalid regex for '" + field.getFieldLabel() + "'");
                        }
                    }
                    finalValue = sanitized;
                }
            }
            cleanedData.put(key, finalValue);
        }
        return cleanedData;
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
        int dynamicCount = 0;

        for (FormField field : fields) {
            String key = field.getFieldKey();
            if (field.getFieldType().equalsIgnoreCase("HEADING")
                    || field.getFieldType().equalsIgnoreCase("PAGE_BREAK")) {
                continue;
            }

            if ("DROPDOWN".equalsIgnoreCase(field.getFieldType()) &&
                    field.getDataSourceTable() != null && !field.getDataSourceTable().isBlank() &&
                    field.getDataSourceColumn() != null && !field.getDataSourceColumn().isBlank()) {

                String column = field.getDataSourceColumn();
                String alias = "d" + (++dynamicCount);
                sql.append(", COALESCE(CAST(").append(alias).append(".\"").append(column)
                        .append("\" AS VARCHAR), s.\"").append(key).append("\") as \"").append(key).append("\" ");
                sql.append(", s.\"").append(key).append("\" as \"").append(key).append("_raw\" ");
            } else {
                sql.append(", s.\"").append(key).append("\" ");
            }
        }

        sql.append(" FROM \"").append(tableName).append("\" s ");

        dynamicCount = 0;
        for (FormField field : fields) {
            if ("DROPDOWN".equalsIgnoreCase(field.getFieldType()) &&
                    field.getDataSourceTable() != null && !field.getDataSourceTable().isBlank() &&
                    field.getDataSourceColumn() != null && !field.getDataSourceColumn().isBlank()) {

                String table = field.getDataSourceTable();
                String key = field.getFieldKey();
                String alias = "d" + (++dynamicCount);

                sql.append(" LEFT JOIN \"").append(table).append("\" ").append(alias)
                        .append(" ON s.\"").append(key).append("\" = CAST(").append(alias).append(".id AS VARCHAR) ");
            }
        }

        boolean hasWhere = false;
        String sqlCheckDeleted = "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = ? AND column_name = 'deleted' AND table_schema = CURRENT_SCHEMA()";
        Integer hasDeletedCol = jdbcTemplate.queryForObject(sqlCheckDeleted, Integer.class, tableName);
        if (hasDeletedCol != null && hasDeletedCol > 0) {
            sql.append(" WHERE s.\"deleted\" = FALSE ");
            if (filterByVersion) {
                sql.append(" AND s.\"version_id\" = CAST(? AS UUID) ");
            }
            hasWhere = true;
        } else {
            if (filterByVersion) {
                sql.append(" WHERE s.\"version_id\" = CAST(? AS UUID) ");
                hasWhere = true;
            }
        }

        if (ids != null && !ids.isEmpty()) {
            sql.append(hasWhere ? " AND " : " WHERE ");
            String idList = ids.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
            sql.append(" s.\"id\" IN (").append(idList).append(") ");
        }

        sql.append(" ORDER BY s.\"submitted_at\" DESC");
        if (filterByVersion) {
            return jdbcTemplate.queryForList(sql.toString(), versionId.toString());
        } else {
            return jdbcTemplate.queryForList(sql.toString());
        }
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
