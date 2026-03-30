package com.sttl.formbuilder.util;

import com.sttl.formbuilder.service.ExpressionEvaluator;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ExpressionEvaluatorTest {

    private final ExpressionEvaluator evaluator = new ExpressionEvaluator();

    @Test
    void testSimpleComparisons() {
        Map<String, Object> context = new HashMap<>();
        context.put("age", 25);
        context.put("name", "John");

        assertTrue((Boolean) evaluator.evaluate("age >= 18", context));
        assertFalse((Boolean) evaluator.evaluate("age < 18", context));
        assertTrue((Boolean) evaluator.evaluate("name == \"John\"", context));
        assertFalse((Boolean) evaluator.evaluate("name != \"John\"", context));
    }

    @Test
    void testLogicalOperators() {
        Map<String, Object> context = new HashMap<>();
        context.put("age", 25);
        context.put("country", "US");

        assertTrue((Boolean) evaluator.evaluate("age >= 18 && country == \"US\"", context));
        assertTrue((Boolean) evaluator.evaluate("age < 18 || country == \"US\"", context));
        assertFalse((Boolean) evaluator.evaluate("age < 18 || country == \"UK\"", context));
        assertTrue((Boolean) evaluator.evaluate("!(age < 18)", context));
    }

    @Test
    void testArithmeticOperators() {
        Map<String, Object> context = new HashMap<>();
        context.put("price", 100);
        context.put("tax", 0.1);

        assertEquals(110.0, (Double) evaluator.evaluate("price + (price * tax)", context));
        assertEquals(90.0, (Double) evaluator.evaluate("price - (price * tax)", context));
        assertEquals(50.0, (Double) evaluator.evaluate("price / 2", context));
    }

    @Test
    void testOperatorPrecedence() {
        Map<String, Object> context = new HashMap<>();
        // 2 + 3 * 4 should be 14, not 20
        assertEquals(14.0, (Double) evaluator.evaluate("2 + 3 * 4", context));
        // (2 + 3) * 4 should be 20
        assertEquals(20.0, (Double) evaluator.evaluate("(2 + 3) * 4", context));
        
        // true || false && false should be true (&& higher than ||)
        assertTrue((Boolean) evaluator.evaluate("true || false && false", context));
    }

    @Test
    void testFieldReferencesWithHyphens() {
        Map<String, Object> context = new HashMap<>();
        context.put("field-1", 10);
        context.put("field_2", 20);

        assertEquals(30.0, (Double) evaluator.evaluate("field-1 + field_2", context));
    }

    @Test
    void testNonNumericArithmetic() {
        Map<String, Object> context = new HashMap<>();
        context.put("a", "abc");
        context.put("b", 10.0);

        // "abc" as number should be 0.0
        assertEquals(10.0, (Double) evaluator.evaluate("a + b", context));
    }

    @Test
    void testContains() {
        Map<String, Object> context = new HashMap<>();
        context.put("name", "John Doe");
        context.put("email", "john@example.com");

        assertTrue((Boolean) evaluator.evaluate("name contains \"John\"", context));
        assertTrue((Boolean) evaluator.evaluate("name contains \"john\"", context)); // case-insensitive
        assertTrue((Boolean) evaluator.evaluate("email contains \"@example\"", context));
        assertFalse((Boolean) evaluator.evaluate("name contains \"Jane\"", context));
    }

    @Test
    void testNewOperators() {
        Map<String, Object> context = new HashMap<>();
        context.put("city", "New York");
        context.put("status", "pending_review");
        context.put("code", "ABC-123");

        assertTrue((Boolean) evaluator.evaluate("city starts_with \"New\"", context));
        assertTrue((Boolean) evaluator.evaluate("city ends_with \"York\"", context));
        assertTrue((Boolean) evaluator.evaluate("status matches \".*_review\"", context));
        assertTrue((Boolean) evaluator.evaluate("status not_matches \"completed\"", context));
        assertTrue((Boolean) evaluator.evaluate("code matches \"[A-Z]{3}-\\\\d{3}\"", context));
    }

    @Test
    void testInListOperators() {
        Map<String, Object> context = new HashMap<>();
        context.put("color", "red");
        context.put("tags", "urgent, high, pending");

        assertTrue((Boolean) evaluator.evaluate("color in \"red, blue, green\"", context));
        assertFalse((Boolean) evaluator.evaluate("color in \"blue, green\"", context));
        assertTrue((Boolean) evaluator.evaluate("color not_in \"blue, green\"", context));
        
        context.put("color", "RED"); // Case insensitive
        assertTrue((Boolean) evaluator.evaluate("color in \"red, blue\"", context));
    }

    @Test
    void testNumericStringComparisons() {
        Map<String, Object> context = new HashMap<>();
        context.put("age", "5");
        
        // Lexicographically "5" > "18" is TRUE, but numerically it is FALSE
        // Our engine should now prefer numeric comparison if both are strings
        assertFalse((Boolean) evaluator.evaluate("age > \"18\"", context));
        assertTrue((Boolean) evaluator.evaluate("age < \"18\"", context));
        
        context.put("score", "95.5");
        assertTrue((Boolean) evaluator.evaluate("score >= \"90\"", context));
    }

    @Test
    void testIsExpressions() {
        Map<String, Object> context = new HashMap<>();
        context.put("active", "true");
        context.put("optin", "yes");
        context.put("flag", "1");
        context.put("empty", "");

        // These mimic what RoleService generates for IS_TRUE / IS_FALSE
        assertTrue((Boolean) evaluator.evaluate("active == \"true\" || active == true", context));
        assertTrue((Boolean) evaluator.evaluate("optin == \"yes\"", context));
        assertTrue((Boolean) evaluator.evaluate("flag == \"1\"", context));
        assertTrue((Boolean) evaluator.evaluate("empty == \"\"", context));
    }
}
