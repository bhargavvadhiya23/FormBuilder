package com.sttl.formbuilder.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * A simple, secure recursive descent parser for boolean and arithmetic expressions.
 * Supports: &&, ||, !, ==, !=, <, <=, >, >=, +, -, *, /, (), strings, numbers, and field keys.
 */
@Slf4j
@Service
public class ExpressionEvaluator {

    /**
     * Evaluates an expression against a map of field values.
     *
     * @param expression The expression string (e.g., "age >= 18 && country == \"US\"")
     * @param context    Map of fieldKey -> value
     * @return Result of evaluation (Boolean, Double, or String)
     */
    public Object evaluate(String expression, Map<String, Object> context) {
        if (expression == null || expression.isBlank()) {
            return true; // Default to true if empty? Or maybe null? Let's say true for rules.
        }
        try {
            return new Parser(expression, context).parse();
        } catch (Exception e) {
            log.error("Failed to evaluate expression: {} | Error: {}", expression, e.getMessage());
            return false; // Fail safe
        }
    }

    private static class Parser {
        private final String input;
        private final Map<String, Object> context;
        private int pos = 0;

        Parser(String input, Map<String, Object> context) {
            this.input = input;
            this.context = context;
        }

        Object parse() {
            Object result = parseLogicalOr();
            consumeWhitespace();
            if (pos < input.length()) {
                throw new RuntimeException("Unexpected character: " + input.charAt(pos));
            }
            return result;
        }

        // Logical OR: && has higher precedence than ||
        private Object parseLogicalOr() {
            Object left = parseLogicalAnd();
            while (match("||")) {
                Object right = parseLogicalAnd();
                left = toBoolean(left) || toBoolean(right);
            }
            return left;
        }

        // Logical AND: Comparison has higher precedence than &&
        private Object parseLogicalAnd() {
            Object left = parseComparison();
            while (match("&&")) {
                Object right = parseComparison();
                left = toBoolean(left) && toBoolean(right);
            }
            return left;
        }

        // Comparison: Arithmetic has higher precedence than ==, !=, <, etc.
        private Object parseComparison() {
            Object left = parseAddition();
            consumeWhitespace();
            if (match("==")) {
                return compare(left, parseAddition()) == 0;
            } else if (match("!=")) {
                return compare(left, parseAddition()) != 0;
            } else if (match("<=")) {
                return compare(left, parseAddition()) <= 0;
            } else if (match(">=")) {
                return compare(left, parseAddition()) >= 0;
            } else if (match("<")) {
                return compare(left, parseAddition()) < 0;
            } else if (match(">")) {
                return compare(left, parseAddition()) > 0;
            } else if (matchKeyword("contains")) {
                Object right = parseAddition();
                return String.valueOf(left).toLowerCase().contains(String.valueOf(right).toLowerCase());
            } else if (matchKeyword("starts_with")) {
                Object right = parseAddition();
                return String.valueOf(left).toLowerCase().startsWith(String.valueOf(right).toLowerCase());
            } else if (matchKeyword("ends_with")) {
                Object right = parseAddition();
                return String.valueOf(left).toLowerCase().endsWith(String.valueOf(right).toLowerCase());
            } else if (matchKeyword("matches")) {
                Object right = parseAddition();
                try { return String.valueOf(left).matches(String.valueOf(right)); } catch (Exception e) { return false; }
            } else if (matchKeyword("not_matches")) {
                Object right = parseAddition();
                try { return !String.valueOf(left).matches(String.valueOf(right)); } catch (Exception e) { return false; }
            } else if (matchKeyword("in")) {
                Object right = parseAddition();
                String listStr = String.valueOf(right);
                String valStr = String.valueOf(left).toLowerCase().trim();
                for (String s : listStr.split(",")) {
                    if (s.trim().toLowerCase().equals(valStr)) return true;
                }
                return false;
            } else if (matchKeyword("not_in")) {
                Object right = parseAddition();
                String listStr = String.valueOf(right);
                String valStr = String.valueOf(left).toLowerCase().trim();
                boolean found = false;
                for (String s : listStr.split(",")) {
                    if (s.trim().toLowerCase().equals(valStr)) { found = true; break; }
                }
                return !found;
            }
            return left;
        }

        // Addition/Subtraction
        private Object parseAddition() {
            Object left = parseMultiplication();
            while (true) {
                if (match("+")) {
                    left = add(left, parseMultiplication());
                } else if (match("-")) {
                    left = subtract(left, parseMultiplication());
                } else {
                    break;
                }
            }
            return left;
        }

        // Multiplication/Division
        private Object parseMultiplication() {
            Object left = parseUnary();
            while (true) {
                if (match("*")) {
                    left = multiply(left, parseUnary());
                } else if (match("/")) {
                    left = divide(left, parseUnary());
                } else {
                    break;
                }
            }
            return left;
        }

        // Unary: ! or -
        private Object parseUnary() {
            consumeWhitespace();
            if (match("!")) {
                return !toBoolean(parseUnary());
            }
            if (match("-")) {
                Object val = parseUnary();
                if (val instanceof Number) return -((Number) val).doubleValue();
                return 0.0;
            }
            return parsePrimary();
        }

        // Primary: ( ), literal, or identifier
        private Object parsePrimary() {
            consumeWhitespace();
            if (match("(")) {
                Object result = parseLogicalOr();
                if (!match(")")) throw new RuntimeException("Missing closing parenthesis");
                return result;
            }

            // String literal
            if (peek() == '\"') {
                return parseString();
            }

            // Number literal
            if (Character.isDigit(peek()) || peek() == '.') {
                return parseNumber();
            }

            // Boolean literal
            if (input.startsWith("true", pos)) {
                int next = pos + 4;
                if (next >= input.length() || !isIdentifierPart(input.charAt(next))) {
                    pos += 4; return true;
                }
            }
            if (input.startsWith("false", pos)) {
                int next = pos + 5;
                if (next >= input.length() || !isIdentifierPart(input.charAt(next))) {
                    pos += 5; return false;
                }
            }

            // Identifier (Field Key)
            return parseIdentifier();
        }

        private String parseString() {
            pos++; // Skip opening quote
            StringBuilder sb = new StringBuilder();
            while (pos < input.length() && input.charAt(pos) != '\"') {
                if (input.charAt(pos) == '\\') pos++; // Handle escape
                sb.append(input.charAt(pos++));
            }
            if (pos >= input.length()) throw new RuntimeException("Unterminated string");
            pos++; // Skip closing quote
            return sb.toString();
        }

        private Double parseNumber() {
            int start = pos;
            while (pos < input.length() && (Character.isDigit(input.charAt(pos)) || input.charAt(pos) == '.')) {
                pos++;
            }
            return Double.parseDouble(input.substring(start, pos));
        }

        private Object parseIdentifier() {
            int start = pos;
            while (pos < input.length() && (Character.isLetterOrDigit(input.charAt(pos)) || input.charAt(pos) == '_' || input.charAt(pos) == '-')) {
                pos++;
            }
            String key = input.substring(start, pos);
            if (key.isEmpty()) {
                throw new RuntimeException("Unexpected character '" + peek() + "' at " + pos);
            }
            
            // Case-insensitive lookup
            if (context.containsKey(key)) return context.get(key);
            for (String k : context.keySet()) {
                if (k.equalsIgnoreCase(key)) return context.get(k);
            }
            return "";
        }

        // ─── Helpers ─────────────────────────────────────────────────────────

        private void consumeWhitespace() {
            while (pos < input.length() && Character.isWhitespace(input.charAt(pos))) {
                pos++;
            }
        }

        private char peek() {
            return pos < input.length() ? input.charAt(pos) : '\0';
        }

        private boolean match(String s) {
            consumeWhitespace();
            if (input.startsWith(s, pos)) {
                pos += s.length();
                return true;
            }
            return false;
        }

        private boolean matchKeyword(String keyword) {
            consumeWhitespace();
            if (input.regionMatches(true, pos, keyword, 0, keyword.length())) {
                int nextPos = pos + keyword.length();
                if (nextPos >= input.length() || !isIdentifierPart(input.charAt(nextPos))) {
                    pos = nextPos;
                    return true;
                }
            }
            return false;
        }

        private boolean toBoolean(Object val) {
            if (val instanceof Boolean) return (Boolean) val;
            if (val instanceof String) {
                String s = (String) val;
                return s.equalsIgnoreCase("true") || s.equalsIgnoreCase("yes") || s.equals("1");
            }
            return false;
        }

        private double toDouble(Object val) {
            if (val instanceof Number) return ((Number) val).doubleValue();
            if (val instanceof String) {
                try {
                    return Double.parseDouble((String) val);
                } catch (Exception e) {
                    return 0.0;
                }
            }
            return 0.0;
        }

        private int compare(Object a, Object b) {
            if (a instanceof Number || b instanceof Number) {
                return Double.compare(toDouble(a), toDouble(b));
            }
            String sa = String.valueOf(a);
            String sb = String.valueOf(b);
            // If both represent numbers, use numeric comparison
            try {
                double da = Double.parseDouble(sa);
                double db = Double.parseDouble(sb);
                return Double.compare(da, db);
            } catch (Exception e) {
                return sa.compareTo(sb);
            }
        }

        private Object add(Object a, Object b) {
            return toDouble(a) + toDouble(b);
        }

        private Object subtract(Object a, Object b) {
            return toDouble(a) - toDouble(b);
        }

        private Object multiply(Object a, Object b) {
            return toDouble(a) * toDouble(b);
        }

        private Object divide(Object a, Object b) {
            double divisor = toDouble(b);
            if (divisor == 0) return 0.0;
            return toDouble(a) / divisor;
        }
        private boolean isIdentifierPart(char c) {
            return Character.isLetterOrDigit(c) || c == '_' || c == '-';
        }
    }
}
