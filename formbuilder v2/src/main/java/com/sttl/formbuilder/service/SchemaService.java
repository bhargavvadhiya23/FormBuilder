package com.sttl.formbuilder.service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.UUID;

import com.sttl.formbuilder.util.InputSanitizer;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.sttl.formbuilder.entity.FormVersion;
import com.sttl.formbuilder.entity.FormField;
import com.sttl.formbuilder.repository.FormFieldRepository;
import com.sttl.formbuilder.repository.FormVersionRepository;
import com.sttl.formbuilder.util.SqlTypeMapper;

import org.springframework.transaction.annotation.Transactional;

@Service
public class SchemaService {

    private final JdbcTemplate jdbcTemplate;
    private final FormVersionRepository versionRepository;
    private final FormFieldRepository fieldRepository;
    private final SchemaDriftService schemaDriftService;

    // Track "broken" tables in memory to avoid repeated DB checks on every submission
    private final Set<String> driftedTables = Collections.synchronizedSet(new HashSet<>());

    public SchemaService(JdbcTemplate jdbcTemplate,
            FormVersionRepository versionRepository,
            FormFieldRepository fieldRepository,
            SchemaDriftService schemaDriftService) {
        this.jdbcTemplate = jdbcTemplate;
        this.versionRepository = versionRepository;
        this.fieldRepository = fieldRepository;
        this.schemaDriftService = schemaDriftService;
    }

    @Transactional
    public void publishVersion(UUID versionId) {
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        List<FormField> fields = fieldRepository.findByVersion_IdOrderByFieldOrder(versionId);

        if (fields.isEmpty()) {
            throw new RuntimeException("Cannot publish: form has no fields defined");
        }

        // ─── DRIFT CHECK ─────────────────────────────────────────────────────
        // We check drift on any EXISTING table BEFORE we try to sync it.
        // If it's a new table, validation will skip or pass.
        // We use the PREVIOUS version's fields to see if the table was modified 
        // behind our back since the last publish.
        Optional<FormVersion> currentActive = versionRepository.findByFormIdAndIsActiveTrue(version.getForm().getId())
                .or(() -> versionRepository.findTopByFormIdAndStatus(version.getForm().getId(), "PUBLISHED"));
        
        if (currentActive.isPresent()) {
            FormVersion active = currentActive.get();
            List<FormField> activeFields = fieldRepository.findByVersion_IdOrderByFieldOrder(active.getId());
            try {
                schemaDriftService.validateSchema(active, activeFields);
            } catch (com.sttl.formbuilder.exception.SchemaDriftException e) {
                // If drift is detected on publish, we block the publish!
                throw e; 
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        String sanitizedFormName = InputSanitizer.sanitizeTableNamePart(version.getForm().getName());
        String shortUuid = version.getForm().getId().toString().substring(0, 8);
        String tableName = ("form_data_" + sanitizedFormName + "_" + shortUuid).toLowerCase();
        if (tableName.length() > 63) {
            tableName = tableName.substring(0, 63);
        }

        // Check if table exists in public schema
        String checkTableSql = "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = ? AND table_schema = 'public')";
        Boolean exists = jdbcTemplate.queryForObject(checkTableSql, Boolean.class, tableName);

        if (Boolean.FALSE.equals(exists)) {
            StringBuilder sql = new StringBuilder();
            sql.append("CREATE TABLE \"").append(tableName).append("\" (")
                    .append("\"id\" BIGSERIAL PRIMARY KEY,")
                    .append("\"submitted_at\" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,")
                    .append("\"submitted_by\" UUID REFERENCES users(id),")
                    .append("\"version_id\" UUID REFERENCES form_versions(id),") 
                    .append("\"status\" VARCHAR(20) DEFAULT 'COMPLETED',")
                    .append("\"deleted\" BOOLEAN DEFAULT FALSE,");

            for (FormField field : fields) {
                if ("HEADING".equalsIgnoreCase(field.getFieldType())
                        || "PAGE_BREAK".equalsIgnoreCase(field.getFieldType())) {
                    continue;
                }
                String safeKey = field.getFieldKey();
                String sqlType = SqlTypeMapper.map(field.getFieldType());
                sql.append("\"").append(safeKey).append("\" ").append(sqlType);
                if (Boolean.TRUE.equals(field.getIsUnique())) {
                    sql.append(" UNIQUE");
                }
                sql.append(",");
            }
            sql.deleteCharAt(sql.length() - 1);
            sql.append(")");
            jdbcTemplate.execute(sql.toString());
        } else {
            // Requirement: "All existing drafts for the previous version shall be dropped."
            // Since all versions share the same table, we delete DRAFT records from this table.
            String cleanupDraftsSql = "DELETE FROM \"" + tableName + "\" WHERE \"status\" = 'DRAFT'";
            jdbcTemplate.execute(cleanupDraftsSql);
        }
        // Update table schema (handles both new and existing tables)
        syncSchema(tableName, fields);

        // Update current version status
        version.setStatus("PUBLISHED");
        version.setTableName(tableName);
        version.setPublishedAt(LocalDateTime.now());
        version.setActive(true); // Marked as active on publish
        versionRepository.save(version);

        // Decommission any existing published version AND drop any remaining drafts
        List<FormVersion> otherVersions = versionRepository.findByFormId(version.getForm().getId());
        for (FormVersion ov : otherVersions) {
            if (ov.getId().equals(version.getId())) continue;

            if (ov.getStatus().equals("PUBLISHED")) {
                ov.setStatus("ARCHIVED");
                ov.setActive(false); // Deactivate old versions
                versionRepository.save(ov);
            } else if (ov.getStatus().equals("DRAFT")) {
                // Delete fields first to avoid FK issues
                fieldRepository.deleteAll(fieldRepository.findByVersion_IdOrderByFieldOrder(ov.getId()));
                versionRepository.delete(ov);
            }
        }
    }

    private void syncSchema(String tableName, List<FormField> fields) {
        // Get existing columns for this table in public schema
        String getColsSql = "SELECT column_name FROM information_schema.columns WHERE table_name = ? AND table_schema = 'public'";
        List<String> existingCols = jdbcTemplate.queryForList(getColsSql, String.class, tableName);

        if (!existingCols.contains("submitted_by")) {
            jdbcTemplate
                    .execute("ALTER TABLE \"" + tableName + "\" ADD COLUMN \"submitted_by\" UUID REFERENCES users(id)");
        }

        if (!existingCols.contains("version_id")) {
            jdbcTemplate.execute("ALTER TABLE \"" + tableName + "\" ADD COLUMN \"version_id\" UUID REFERENCES form_versions(id)");
        }

        if (!existingCols.contains("deleted")) {
            jdbcTemplate.execute("ALTER TABLE \"" + tableName + "\" ADD COLUMN \"deleted\" BOOLEAN DEFAULT FALSE");
        }

        for (FormField field : fields) {
            String fieldType = field.getFieldType();
            if ("HEADING".equalsIgnoreCase(fieldType) || "PAGE_BREAK".equalsIgnoreCase(fieldType)) {
                continue;
            }
            String safeKey = field.getFieldKey();
            String sqlType = SqlTypeMapper.map(fieldType);

            if (!existingCols.contains(safeKey)) {
                // Add missing column
                StringBuilder alterSql = new StringBuilder("ALTER TABLE \"")
                        .append(tableName)
                        .append("\" ADD COLUMN \"")
                        .append(safeKey)
                        .append("\" ")
                        .append(sqlType);

                if (Boolean.TRUE.equals(field.getIsUnique())) {
                    alterSql.append(" UNIQUE");
                }

                jdbcTemplate.execute(alterSql.toString());
            }

            // Handle requirement backfilling if field is required
            if (Boolean.TRUE.equals(field.getRequired())) {
                Object placeholder = getPlaceholder(fieldType);
                String updateSql = "UPDATE \"" + tableName + "\" SET \"" + safeKey + "\" = ? WHERE \"" + safeKey
                        + "\" IS NULL";
                jdbcTemplate.update(updateSql, placeholder);
            }
        }
    }

    private Object getPlaceholder(String fieldType) {
        String type = fieldType.toUpperCase();
        return switch (type) {
            case "NUMBER", "DECIMAL", "LINEAR_SCALE", "RATING", "RANGE", "INTEGER" -> 0;
            case "TOGGLE" -> false;
            default -> "";
        };
    }

    /**
     * Startup check: validate all published forms for schema drift.
     */
    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void checkAllPublishedFormsOnStartup() {
        System.out.println("Starting Global Schema Drift Detection...");
        List<FormVersion> publishedVersions = versionRepository.findByStatus("PUBLISHED");
        int driftedCount = 0;

        for (FormVersion v : publishedVersions) {
            try {
                List<FormField> fs = fieldRepository.findByVersion_IdOrderByFieldOrder(v.getId());
                schemaDriftService.validateSchema(v, fs);
                driftedTables.remove(v.getTableName());
            } catch (Exception e) {
                driftedCount++;
                System.err.println("CRITICAL: Schema drift detected on startup for table '" + 
                        v.getTableName() + "': " + e.getMessage());
                if (v.getTableName() != null) {
                    driftedTables.add(v.getTableName());
                }
            }
        }

        if (driftedCount > 0) {
            System.err.println("Global Schema Drift Check completed: " + driftedCount + " tables are INCONSISTENT and have been BLOCKED.");
        } else {
            System.out.println("Global Schema Drift Check completed: All tables are healthy.");
        }
    }

    public boolean isDrifted(String tableName) {
        return driftedTables.contains(tableName);
    }

    /**
     * Returns a list of forms that are currently marked as drifted.
     */
    public List<Map<String, Object>> getDriftedForms() {
        List<Map<String, Object>> result = new ArrayList<>();
        if (driftedTables.isEmpty()) return result;

        List<FormVersion> published = versionRepository.findByStatus("PUBLISHED");
        for (FormVersion v : published) {
            if (driftedTables.contains(v.getTableName())) {
                Map<String, Object> formInfo = new HashMap<>();
                formInfo.put("id", v.getForm().getId());
                formInfo.put("name", v.getForm().getName());
                formInfo.put("tableName", v.getTableName());
                result.add(formInfo);
            }
        }
        return result;
    }
}