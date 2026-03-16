package com.sttl.formbuilder.util;

public class SqlTypeMapper {

    /**
     * Maps Google Forms field types to PostgreSQL column types.
     * All choice/text types use TEXT or VARCHAR so we can store
     * comma-separated values (CHECKBOXES) or long strings safely.
     */
    public static String map(String type) {
        return switch (type.toUpperCase()) {
            // Text types
            case "SHORT_ANSWER" -> "VARCHAR(500)";
            case "PARAGRAPH" -> "TEXT";
            case "EMAIL" -> "VARCHAR(255)";
            case "PHONE" -> "VARCHAR(30)";
            case "URL" -> "VARCHAR(500)";

            // Choice types (store selected value(s) as text)
            case "MULTIPLE_CHOICE" -> "VARCHAR(500)";
            case "DROPDOWN" -> "VARCHAR(500)";
            case "CHECKBOXES" -> "TEXT"; // JSON array of selected
            case "MC_GRID" -> "TEXT"; // JSON object of row -> col
            case "CHECKBOX_GRID" -> "TEXT"; // JSON object of row -> [cols]

            // Numeric
            case "NUMBER" -> "NUMERIC";
            case "LINEAR_SCALE" -> "INTEGER";
            case "RATING" -> "INTEGER";
            case "HEADING" -> "VARCHAR(1)"; // No data stored, just for display
            case "PAGE_BREAK" -> "VARCHAR(1)"; // No data stored

            // Date/Time
            case "DATE" -> "VARCHAR(20)";
            case "TIME" -> "VARCHAR(20)";
            case "DATE_TIME" -> "VARCHAR(40)";
            case "MONTH" -> "VARCHAR(20)";
            case "WEEK" -> "VARCHAR(20)";

            // HTML5 Specific
            case "PASSWORD" -> "VARCHAR(500)";
            case "COLOR" -> "VARCHAR(20)";
            case "RANGE" -> "NUMERIC";
            case "FILE" -> "VARCHAR(1000)";
            case "SEARCH" -> "VARCHAR(500)";

            // Legacy types (backward compat)
            case "TEXT" -> "VARCHAR(500)";
            case "INTEGER" -> "INTEGER";
            case "BOOLEAN" -> "VARCHAR(10)";
            case "DECIMAL" -> "NUMERIC";

            default -> throw new RuntimeException(
                    "Unsupported field type: " + type +
                            ". Allowed: SHORT_ANSWER, PARAGRAPH, MULTIPLE_CHOICE, " +
                            "CHECKBOXES, MC_GRID, CHECKBOX_GRID, DROPDOWN, DATE, TIME, " +
                            "DATE_TIME, MONTH, WEEK, EMAIL, NUMBER, LINEAR_SCALE, RATING, " +
                            "PHONE, URL, PASSWORD, COLOR, RANGE, FILE, SEARCH, HEADING, PAGE_BREAK");
        };
    }
}