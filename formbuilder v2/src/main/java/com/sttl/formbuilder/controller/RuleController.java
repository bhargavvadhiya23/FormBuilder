package com.sttl.formbuilder.controller;

import com.sttl.formbuilder.entity.FormRule;
import com.sttl.formbuilder.entity.User;
import com.sttl.formbuilder.model.SubmissionFact;
import com.sttl.formbuilder.service.RuleService;
import com.sttl.formbuilder.service.FormService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST API for managing business rules per form.
 *
 * Base URL: /admin/api/forms/{formId}/rules
 */
@RestController
@RequestMapping("/admin/api/forms/{formId}/rules")
public class RuleController {

    private final RuleService ruleService;
    private final FormService formService;

    public RuleController(RuleService ruleService, FormService formService) {
        this.ruleService = ruleService;
        this.formService = formService;
    }

    // ─── GET all rules for a form ────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<FormRule>> getRules(@PathVariable UUID formId,
            @AuthenticationPrincipal User currentUser) {
        formService.getFormByIdAndUserId(formId, currentUser.getId());
        return ResponseEntity.ok(ruleService.getRulesForForm(formId));
    }

    // ─── GET a single rule ───────────────────────────────────────────────────

    @GetMapping("/{ruleId}")
    public ResponseEntity<FormRule> getRule(@PathVariable UUID formId, @PathVariable UUID ruleId,
            @AuthenticationPrincipal User currentUser) {
        formService.getFormByIdAndUserId(formId, currentUser.getId());
        FormRule rule = ruleService.getRule(ruleId);
        if (!rule.getFormId().equals(formId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(rule);
    }

    // ─── CREATE a new rule ───────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<FormRule> createRule(@PathVariable UUID formId,
            @RequestBody FormRule rule,
            @AuthenticationPrincipal User currentUser) {
        formService.getFormByIdAndUserId(formId, currentUser.getId());
        
        // ─── Guardrails: Max Rules ───────────────────────────────────────
        long ruleCount = ruleService.getRulesForForm(formId).size();
        if (ruleCount >= 100) {
            throw new IllegalArgumentException("Maximum of 100 business rules allowed per form.");
        }
        // ─────────────────────────────────────────────────────────────────

        // Validate action type
        validateRule(rule);
        rule.setFormId(formId);
        rule.setCreatedBy(currentUser);
        return ResponseEntity.ok(ruleService.saveRule(rule));
    }

    // ─── UPDATE an existing rule ─────────────────────────────────────────────

    @PutMapping("/{ruleId}")
    public ResponseEntity<FormRule> updateRule(@PathVariable UUID formId,
            @PathVariable UUID ruleId,
            @RequestBody FormRule updated, @AuthenticationPrincipal User currentUser) {
        formService.getFormByIdAndUserId(formId, currentUser.getId());
        validateRule(updated);
        FormRule existing = ruleService.getRule(ruleId);
        if (!existing.getFormId().equals(formId)) {
            return ResponseEntity.notFound().build();
        }

        // Merge updatable fields
        existing.setRuleName(updated.getRuleName());
        existing.setDescription(updated.getDescription());
        existing.setConditionField(updated.getConditionField());
        existing.setConditionOperator(updated.getConditionOperator());
        existing.setConditionValue(updated.getConditionValue());
        existing.setConditionExpression(updated.getConditionExpression());
        existing.setActionType(updated.getActionType());
        existing.setActionField(updated.getActionField());
        existing.setActionValue(updated.getActionValue());
        existing.setActionExpression(updated.getActionExpression());
        existing.setPriority(updated.getPriority());
        existing.setEnabled(updated.getEnabled());

        return ResponseEntity.ok(ruleService.saveRule(existing));
    }

    // ─── DELETE a rule ───────────────────────────────────────────────────────

    @DeleteMapping("/{ruleId}")
    public ResponseEntity<Map<String, String>> deleteRule(@PathVariable UUID formId,
            @PathVariable UUID ruleId, @AuthenticationPrincipal User currentUser) {
        formService.getFormByIdAndUserId(formId, currentUser.getId());
        FormRule existing = ruleService.getRule(ruleId);
        if (!existing.getFormId().equals(formId)) {
            return ResponseEntity.notFound().build();
        }
        ruleService.deleteRule(ruleId);
        return ResponseEntity.ok(Map.of("message", "Rule deleted successfully"));
    }

    // ─── TEST rules against sample data ─────────────────────────────────────

    @PostMapping("/test")
    public ResponseEntity<Map<String, Object>> testRules(@PathVariable UUID formId,
            @RequestBody Map<String, Object> sampleData, @AuthenticationPrincipal User currentUser) {
        formService.getFormByIdAndUserId(formId, currentUser.getId());
        SubmissionFact fact = ruleService.evaluateRules(formId, sampleData);

        return ResponseEntity.ok(Map.of(
                "passed", !fact.hasErrors(),
                "errors", fact.getErrors(),
                "dynamicallyRequired", fact.getRequired(),
                "hiddenFields", fact.getHidden(),
                "updatedValues", fact.getUpdatedValues()));
    }

    // ─── Helper ──────────────────────────────────────────────────────────────

    private void validateRule(FormRule rule) {
        if (rule.getRuleName() == null || rule.getRuleName().isBlank()) {
            throw new IllegalArgumentException("Rule name is required");
        }
        if (rule.getActionType() == null || rule.getActionType().isBlank()) {
            throw new IllegalArgumentException("Action type is required");
        }

        String action = rule.getActionType().toUpperCase();
        List<String> validActions = List.of(
                "REQUIRE", "REJECT", "HIDE", "SHOW", "SET_VALUE",
                "SHOW_ERROR", "DISABLE", "ENABLE", "CLEAR_VALUE", "COPY_VALUE", "CALCULATE");
        if (!validActions.contains(action)) {
            throw new IllegalArgumentException("Invalid action type: " + rule.getActionType() +
                    ". Valid values: " + validActions);
        }

        String op = rule.getConditionOperator();
        if (op != null) {
            List<String> validOps = List.of(
                    "ALWAYS", "EQUALS", "NOT_EQUALS", "CONTAINS", "STARTS_WITH", "ENDS_WITH",
                    "GREATER_THAN", "LESS_THAN", "GREATER_THAN_EQUAL", "LESS_THAN_EQUAL",
                    "IS_EMPTY", "IS_NOT_EMPTY", "IS_TRUE", "IS_FALSE",
                    "IN_LIST", "NOT_IN_LIST", "MATCHES_REGEX");
            if (!validOps.contains(op.toUpperCase())) {
                throw new IllegalArgumentException("Invalid operator: " + op + ". Valid: " + validOps);
            }
        }
    }
}
