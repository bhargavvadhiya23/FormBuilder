package com.sttl.formbuilder.service;

import com.sttl.formbuilder.entity.FormField;
import com.sttl.formbuilder.entity.FormVersion;
import com.sttl.formbuilder.exception.SchemaDriftException;
import com.sttl.formbuilder.repository.FormFieldRepository;
import com.sttl.formbuilder.util.SqlTypeMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class SchemaDriftService {

    private static final Logger log = LoggerFactory.getLogger(SchemaDriftService.class);
    private final JdbcTemplate jdbcTemplate;
    private final FormFieldRepository formFieldRepository;

    // Metadata columns that are expected in every submission table
    private static final Set<String> METADATA_COLUMNS = Set.of(
            "id", "submitted_at", "submitted_by", "version_id", "status", "deleted"
    );

    public SchemaDriftService(JdbcTemplate jdbcTemplate, FormFieldRepository formFieldRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.formFieldRepository = formFieldRepository;
    }

    /**
     * Checks for drift between the FormVersion definition and the actual database table.
     * Throws SchemaDriftException if any discrepancy is found.
     */
    public void validateSchema(FormVersion version, List<FormField> expectedFields) {
        String tableName = version.getTableName();
        if (tableName == null || tableName.isBlank()) {
            return; // Not published yet, no table to check
        }

        log.info("Checking schema drift for table: {}", tableName);

        // 1. Get actual columns from DB
        String sql = "SELECT column_name, data_type, character_maximum_length " +
                "FROM information_schema.columns " +
                "WHERE table_schema = 'public' AND table_name = ?";
        
        List<Map<String, Object>> actualCols = jdbcTemplate.queryForList(sql, tableName);
        if (actualCols.isEmpty()) {
            throw new SchemaDriftException("Database schema drift detected: Table '" + tableName + "' does not exist.");
        }

        Map<String, String> actualSchema = new HashMap<>();
        for (Map<String, Object> col : actualCols) {
            String name = (String) col.get("column_name");
            String type = (String) col.get("data_type");
            Integer length = (Integer) col.get("character_maximum_length");
            actualSchema.put(name, normalizeType(type, length));
        }

        // 2. Build expected schema
        Map<String, String> expectedSchema = new HashMap<>();
        for (FormField field : expectedFields) {
            String type = field.getFieldType().toUpperCase();
            if ("HEADING".equals(type) || "PAGE_BREAK".equals(type)) {
                continue;
            }
            String key = field.getFieldKey();
            String sqlType = SqlTypeMapper.map(field.getFieldType());
            expectedSchema.put(key, normalizeExpectedType(sqlType));
        }

        // App-level schema evolution keeps old columns in the same table. These must not be
        // treated as drift when fields are removed in a newer form version.
        Set<String> allowedAppManagedColumns = new HashSet<>(expectedSchema.keySet());
        if (version.getForm() != null && version.getForm().getId() != null) {
            allowedAppManagedColumns.addAll(formFieldRepository.findDistinctSchemaFieldKeysByFormId(version.getForm().getId()));
        }

        // 3. Compare Columns
        List<String> driftDetails = new ArrayList<>();

        // Check for missing columns
        for (String expectedCol : expectedSchema.keySet()) {
            if (!actualSchema.containsKey(expectedCol)) {
                driftDetails.add("Missing column: " + expectedCol);
            } else {
                // Check type mismatch
                String expectedType = expectedSchema.get(expectedCol);
                String actualType = actualSchema.get(expectedCol);
                if (!typesMatch(expectedType, actualType)) {
                    driftDetails.add("Type mismatch for '" + expectedCol + "': expected " + expectedType + ", found " + actualType);
                }
            }
        }

        // Check for extra columns (ignoring metadata)
        for (String actualCol : actualSchema.keySet()) {
            if (!allowedAppManagedColumns.contains(actualCol) && !METADATA_COLUMNS.contains(actualCol)) {
                driftDetails.add("Unexpected extra column: " + actualCol);
            }
        }

        if (!driftDetails.isEmpty()) {
            String errorMsg = "Database schema drift detected in table '" + tableName + "': " + String.join("; ", driftDetails);
            log.error(errorMsg);
            throw new SchemaDriftException(errorMsg);
        }

        log.info("Schema drift check passed for table: {}", tableName);
    }

    private boolean typesMatch(String expected, String actual) {
        if (expected.equals(actual)) return true;
        
        // Exact match preferred for VARCHAR(N)
        if (expected.startsWith("VARCHAR(") && actual.startsWith("VARCHAR(")) {
            return expected.equals(actual);
        }

        // Fallback for cases without explicit length if any
        if (expected.equals("VARCHAR") && actual.equals("VARCHAR")) return true;
        
        if (expected.equals("TEXT") && actual.equals("TEXT")) return true;
        if (expected.equals("NUMERIC") && actual.equals("NUMERIC")) return true;
        if (expected.equals("INTEGER") && actual.equals("INTEGER")) return true;
        if (expected.equals("BOOLEAN") && actual.equals("BOOLEAN")) return true;
        return false;
    }

    private String normalizeType(String pgType, Integer length) {
        String type = pgType.toUpperCase();
        if (type.contains("CHARACTER VARYING")) {
            return length != null ? "VARCHAR(" + length + ")" : "VARCHAR";
        }
        if (type.contains("TEXT")) return "TEXT";
        if (type.contains("NUMERIC")) return "NUMERIC";
        if (type.contains("INTEGER")) return "INTEGER";
        if (type.contains("BOOLEAN")) return "BOOLEAN";
        if (type.contains("TIMESTAMP")) return "TIMESTAMP";
        return type;
    }

    private String normalizeExpectedType(String sqlType) {
        String type = sqlType.toUpperCase();
        if (type.startsWith("VARCHAR")) return type;
        if (type.equals("TEXT")) return "TEXT";
        if (type.equals("NUMERIC")) return "NUMERIC";
        if (type.equals("INTEGER")) return "INTEGER";
        if (type.equals("BOOLEAN")) return "BOOLEAN";
        return type;
    }
}
