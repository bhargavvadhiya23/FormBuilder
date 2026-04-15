package com.sttl.formbuilder.util;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Utility for sanitizing user inputs to prevent XSS and SQL injection.
 * - Strips HTML/script tags
 * - Validates field keys are safe identifiers
 * - Limits string lengths
 */
public class InputSanitizer {

    // Whitelist pattern for DB column names (field keys): lowercase letters,
    // digits, underscores only
    private static final Pattern SAFE_IDENTIFIER = Pattern.compile("^[a-z][a-z0-9_]{0,62}$");

    // Detect common XSS patterns
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern SCRIPT_TAG = Pattern.compile(
            "(<\\s*script[^>]*>.*?<\\s*/\\s*script\\s*>)|javascript:|on\\w+\\s*=",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    /**
     * Validate that a field key is safe to use as a DB column name.
     * Throws RuntimeException if invalid.
     */
    public static String sanitizeFieldKey(String key) {
        if (key == null || key.isBlank()) {
            throw new RuntimeException("Field key must not be blank");
        }
        String cleaned = key.trim().toLowerCase().replaceAll("[^a-z0-9_]", "_").replaceAll("_+", "_");
        if (cleaned.startsWith("_")) {
            cleaned = "f" + cleaned;
        }
        if (!Character.isLetter(cleaned.charAt(0))) {
            cleaned = "f_" + cleaned;
        }

        if (!SAFE_IDENTIFIER.matcher(cleaned).matches()) {
            // If still invalid, force a generic safe one
            cleaned = "field_" + System.currentTimeMillis() % 10000;
        }

        // Block reserved SQL keywords
        String upper = cleaned.toUpperCase();
        for (String keyword : SQL_KEYWORDS) {
            if (upper.equals(keyword)) {
                cleaned = cleaned + "_val";
                break;
            }
        }
        return cleaned;
    }

    /**
     * Generate a safe unique-ready key from a label.
     */
    public static String generateSafeKey(String label) {
        if (label == null || label.isBlank()) {
            return "field_" + (int) (Math.random() * 1000);
        }
        // Convert to lowercase, replace non-alphanumeric with underscore
        String key = label.trim().toLowerCase()
                .replaceAll("[^a-z0-9]", "_")
                .replaceAll("_+", "_") // collapse multiple underscores
                .replaceAll("^_+|_+$", ""); // trim surrounding underscores

        if (key.isEmpty() || !Character.isLetter(key.charAt(0))) {
            key = "f_" + (key.isEmpty() ? "field" : key);
        }

        if (key.length() > 50) {
            key = key.substring(0, 50);
        }

        return key;
    }

    /**
     * Sanitize a string to be used as part of a DB table name.
     */
    public static String sanitizeTableNamePart(String name) {
        if (name == null || name.isBlank()) {
            return "form";
        }
        return name.trim().toLowerCase()
                .replaceAll("[^a-z0-9]", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_+|_+$", "");
    }

    /**
     * Strip HTML tags and dangerous script content from a string.
     * Returns sanitized value.
     */
    public static String sanitizeText(String input) {
        if (input == null)
            return null;
        if (SCRIPT_TAG.matcher(input).find()) {
            throw new RuntimeException("Input contains disallowed script content");
        }
        // Strip HTML tags
        return HTML_TAG.matcher(input).replaceAll("").trim();
    }

    /**
     * Sanitize text with max length check.
     */
    public static String sanitizeText(String input, int maxLength) {
        String cleaned = sanitizeText(input);
        if (cleaned != null && cleaned.length() > maxLength) {
            throw new RuntimeException(
                    "Input exceeds maximum allowed length of " + maxLength + " characters");
        }
        return cleaned;
    }

    /**
     * Sanitize an options object, which could be a List<String> or a Map<String,
     * Object>.
     */
    @SuppressWarnings("unchecked")
    public static Object sanitizeOptions(Object options) {
        if (options == null)
            return null;

        if (options instanceof List) {
            return ((List<?>) options).stream()
                    .map(item -> {
                        if (item instanceof String)
                            return sanitizeOption((String) item);
                        if (item instanceof List || item instanceof Map)
                            return sanitizeOptions(item);
                        return item;
                    })
                    .toList();
        } else if (options instanceof Map) {
            Map<String, Object> map = (Map<String, Object>) options;
            Map<String, Object> cleanMap = new java.util.HashMap<>();
            for (Map.Entry<String, Object> entry : map.entrySet()) {
                Object val = entry.getValue();
                if (val instanceof String) {
                    cleanMap.put(entry.getKey(), sanitizeOption((String) val));
                } else if (val instanceof List || val instanceof Map) {
                    cleanMap.put(entry.getKey(), sanitizeOptions(val));
                } else {
                    cleanMap.put(entry.getKey(), val);
                }
            }
            return cleanMap;
        }
        return options;
    }

    /**
     * Validate an option item (for MULTIPLE_CHOICE, CHECKBOXES, DROPDOWN options).
     */
    public static String sanitizeOption(String option) {
        if (option == null || option.isBlank()) {
            return "Option"; // Provide fallback instead of failing for Grids where empty may happen during
                             // edit
        }
        return sanitizeText(option, 500);
    }

    private static final String[] SQL_KEYWORDS = {
            "SELECT", "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE",
            "TABLE", "DATABASE", "SCHEMA", "INDEX", "VIEW", "TRIGGER", "PROCEDURE",
            "FROM", "WHERE", "JOIN", "UNION", "INTO", "VALUES", "SET", "GRANT", "REVOKE",
            "EXEC", "EXECUTE", "CAST", "CONVERT", "DECLARE", "CURSOR", "FETCH",
            "ID", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CONSTRAINT", "DEFAULT",
            "NULL", "NOT", "AND", "OR", "IN", "LIKE", "BETWEEN", "EXISTS", "HAVING",
            "GROUP", "ORDER", "BY", "LIMIT", "OFFSET", "DISTINCT", "CASE", "WHEN",
            "THEN", "ELSE", "END", "AS", "ON", "TYPE", "COLUMN", "ROW", "ALL", "ANY",
            "INNER", "LEFT", "RIGHT", "FULL", "SEQUENCE", "USER", "ROLE"
    };
}
