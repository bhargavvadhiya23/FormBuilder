package com.sttl.formbuilder.service;

import com.sttl.formbuilder.entity.FormRule;
import com.sttl.formbuilder.model.SubmissionFact;
import com.sttl.formbuilder.repository.FormRuleRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Modern Rule Service.
 * Evaluates business rules using a simple boolean expression language.
 */
@Slf4j
@Service
public class RuleService {

    private final FormRuleRepository ruleRepository;
    private final ExpressionEvaluator expressionEvaluator;

    public RuleService(FormRuleRepository ruleRepository, ExpressionEvaluator expressionEvaluator) {
        this.ruleRepository = ruleRepository;
        this.expressionEvaluator = expressionEvaluator;
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * Evaluate all enabled rules for the given form against the submitted data.
     *
     * @param formId      the form being submitted
     * @param fieldValues map of fieldKey → submitted string value
     * @return SubmissionFact with results populated
     */
    public SubmissionFact evaluateRules(UUID formId, Map<String, Object> fieldValues) {
        // Convert Object values to appropriate types for the fact
        Map<String, String> stringValues = fieldValues.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> e.getValue() != null ? e.getValue().toString() : ""));

        SubmissionFact fact = new SubmissionFact(formId, stringValues);

        List<FormRule> rules = ruleRepository.findByFormIdAndEnabledTrueOrderByPriorityAsc(formId);
        if (rules.isEmpty()) {
            return fact;
        }

        // Use a mutable context for calculations
        Map<String, Object> context = new java.util.HashMap<>(fieldValues);

        for (FormRule rule : rules) {
            String condition = rule.getConditionExpression();
            
            // Backward compatibility: If no expression, build from old fields
            if (condition == null || condition.isBlank()) {
                condition = buildExpressionFromLegacy(rule);
            }

            try {
                if (condition.equalsIgnoreCase("ALWAYS") || (Boolean) expressionEvaluator.evaluate(condition, context)) {
                    applyAction(rule, fact, context);
                }
            } catch (Exception e) {
                log.error("Error evaluating rule '{}': {}", rule.getRuleName(), e.getMessage());
            }
        }

        // After rules fire, check dynamically required fields
        for (String requiredField : fact.getRequired()) {
            if (fact.isEmpty(requiredField)) {
                fact.addError("Field '" + requiredField + "' is required by a business rule.");
            }
        }

        return fact;
    }

    private void applyAction(FormRule rule, SubmissionFact fact, Map<String, Object> context) {
        String actionField = rule.getActionField();
        String actionVal = rule.getActionValue();
        String actionType = rule.getActionType().toUpperCase();

        switch (actionType) {
            case "REQUIRE" -> fact.markRequired(actionField);
            case "REJECT" -> fact.addError(actionVal != null && !actionVal.isBlank() ? actionVal : rule.getRuleName());
            case "HIDE" -> fact.hide(actionField);
            case "SHOW" -> { /* Frontend only */ }
            case "SET_VALUE" -> fact.setValue(actionField, actionVal);
            case "SHOW_ERROR" -> fact.addFieldError(actionField, actionVal);
            case "DISABLE" -> fact.disable(actionField);
            case "ENABLE" -> fact.enable(actionField);
            case "CLEAR_VALUE" -> fact.clearValue(actionField);
            case "COPY_VALUE" -> fact.setValue(actionField, String.valueOf(context.getOrDefault(actionVal, "")));
            case "CALCULATE" -> {
                Object result = expressionEvaluator.evaluate(rule.getActionExpression(), context);
                String resultStr = result != null ? result.toString() : "";
                fact.setValue(actionField, resultStr);
                context.put(actionField, result); // Update context for subsequent rules
            }
            default -> log.warn("Unknown action type: {}", actionType);
        }
    }

    private String buildExpressionFromLegacy(FormRule rule) {
        String op = rule.getConditionOperator();
        if (op == null || op.equalsIgnoreCase("ALWAYS")) return "true";

        String field = rule.getConditionField();
        String value = rule.getConditionValue() != null ? rule.getConditionValue() : "";
        String escapedValue = "\"" + value.replace("\"", "\\\"") + "\"";

        return switch (op.toUpperCase()) {
            case "EQUALS" -> field + " == " + escapedValue;
            case "NOT_EQUALS" -> field + " != " + escapedValue;
            case "CONTAINS" -> field + " contains " + escapedValue;
            case "STARTS_WITH" -> field + " starts_with " + escapedValue;
            case "ENDS_WITH" -> field + " ends_with " + escapedValue;
            case "GREATER_THAN" -> field + " > " + value;
            case "LESS_THAN" -> field + " < " + value;
            case "GREATER_THAN_EQUAL" -> field + " >= " + value;
            case "LESS_THAN_EQUAL" -> field + " <= " + value;
            case "IS_EMPTY" -> field + " == \"\"";
            case "IS_NOT_EMPTY" -> field + " != \"\"";
            case "IS_TRUE" -> "(" + field + " == \"true\" || " + field + " == \"1\" || " + field + " == \"yes\" || " + field + " == true)";
            case "IS_FALSE" -> "(" + field + " == \"false\" || " + field + " == \"0\" || " + field + " == \"no\" || " + field + " == \"\" || " + field + " == false)";
            case "IN_LIST" -> field + " in " + escapedValue;
            case "NOT_IN_LIST" -> field + " not_in " + escapedValue;
            case "MATCHES_REGEX" -> field + " not_matches " + escapedValue; // Maps to "Does NOT Match" UI label
            default -> "true";
        };
    }

    /** CRUD: save or update a rule */
    public FormRule saveRule(FormRule rule) {
        return ruleRepository.save(rule);
    }

    /** CRUD: delete a rule by id */
    public void deleteRule(UUID ruleId) {
        ruleRepository.deleteById(ruleId);
    }

    /** Get all rules for a form (including disabled) */
    public List<FormRule> getRulesForForm(UUID formId) {
        return ruleRepository.findByFormIdOrderByPriorityAsc(formId);
    }

    /** Get a single rule by id */
    public FormRule getRule(UUID ruleId) {
        return ruleRepository.findById(ruleId)
                .orElseThrow(() -> new RuntimeException("Rule not found: " + ruleId));
    }
}
