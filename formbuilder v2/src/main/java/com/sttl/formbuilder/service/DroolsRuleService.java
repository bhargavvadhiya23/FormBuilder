package com.sttl.formbuilder.service;

import com.sttl.formbuilder.entity.FormRule;
import com.sttl.formbuilder.model.SubmissionFact;
import com.sttl.formbuilder.repository.FormRuleRepository;
import org.kie.api.KieServices;
import org.kie.api.builder.KieBuilder;
import org.kie.api.builder.KieFileSystem;
import org.kie.api.builder.Message;
import org.kie.api.builder.Results;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Core Drools service.
 *
 * How it works:
 * 1. Fetch enabled rules for the form from the DB.
 * 2. Dynamically generate DRL source code from those rules.
 * 3. Compile the DRL using KieHelper/KieFileSystem.
 * 4. Create a stateless KieSession, insert the SubmissionFact, fire all rules.
 * 5. Return the fact (callers check fact.hasErrors()).
 */
@Service
public class DroolsRuleService {

    private final FormRuleRepository ruleRepository;
    private final KieServices kieServices;

    public DroolsRuleService(FormRuleRepository ruleRepository, KieServices kieServices) {
        this.ruleRepository = ruleRepository;
        this.kieServices = kieServices;
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * Evaluate all enabled rules for the given form against the submitted data.
     *
     * @param formId      the form being submitted
     * @param fieldValues map of fieldKey → submitted string value
     * @return SubmissionFact with errors populated if any rule failed
     */
    public SubmissionFact evaluateRules(UUID formId, Map<String, Object> fieldValues) {
        // Convert Object values to String for the fact
        Map<String, String> stringValues = fieldValues.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> e.getValue() != null ? e.getValue().toString() : ""));

        SubmissionFact fact = new SubmissionFact(formId, stringValues);

        List<FormRule> rules = ruleRepository.findByFormIdAndEnabledTrueOrderByPriorityAsc(formId);
        if (rules.isEmpty()) {
            return fact; // No rules configured — pass through
        }

        // Build a fresh KieContainer from the dynamically generated DRL
        KieContainer container = buildKieContainer(formId, rules);
        KieSession session = container.newKieSession();
        try {
            session.insert(fact);
            session.fireAllRules();
        } finally {
            session.dispose();
        }

        // After rules fire, check dynamically required fields
        for (String requiredField : fact.getRequired()) {
            if (fact.isEmpty(requiredField)) {
                fact.addError("Field '" + requiredField + "' is required by a business rule.");
            }
        }

        return fact;
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

    // ─── Dynamic DRL Generation ──────────────────────────────────────────────

    /**
     * Generate DRL source from database rules and compile into a KieContainer.
     * Each rule becomes one "rule" block in the DRL.
     */
    private KieContainer buildKieContainer(UUID formId, List<FormRule> rules) {
        String drl = generateDrl(formId, rules);

        KieFileSystem kfs = kieServices.newKieFileSystem();
        kfs.write("src/main/resources/rules/form_" + formId + ".drl", drl);

        KieBuilder kb = kieServices.newKieBuilder(kfs);
        kb.buildAll();

        Results results = kb.getResults();
        if (results.hasMessages(Message.Level.ERROR)) {
            throw new RuntimeException("Drools rule compilation failed: " + results.getMessages());
        }

        return kieServices.newKieContainer(kieServices.getRepository().getDefaultReleaseId());
    }

    /**
     * Convert a list of FormRule objects into valid DRL source code.
     */
    private String generateDrl(UUID formId, List<FormRule> rules) {
        StringBuilder sb = new StringBuilder();
        sb.append("package com.sttl.formbuilder.rules;\n\n");
        sb.append("import com.sttl.formbuilder.model.SubmissionFact;\n\n");

        for (FormRule rule : rules) {
            sb.append("rule \"").append(escapeDrl(rule.getRuleName())).append("_").append(rule.getId()).append("\"\n");
            sb.append("  salience ").append(rule.getPriority()).append("\n");
            sb.append("  when\n");
            sb.append("    $fact : SubmissionFact( formId.toString() == \"").append(formId.toString()).append("\"");

            // Build the condition expression
            String condition = buildCondition(rule);
            if (condition != null && !condition.isBlank()) {
                sb.append(", ").append(condition);
            }

            sb.append(" )\n");
            sb.append("  then\n");
            sb.append(buildAction(rule));
            sb.append("end\n\n");
        }

        return sb.toString();
    }

    /**
     * Translate a FormRule condition into a Drools DRL condition fragment.
     */
    private String buildCondition(FormRule rule) {
        String op = rule.getConditionOperator();
        if (op == null || op.equalsIgnoreCase("ALWAYS")) {
            return null; // No condition — always fires
        }

        String field = escapeDrl(rule.getConditionField());
        String value = escapeDrl(rule.getConditionValue() != null ? rule.getConditionValue() : "");

        return switch (op.toUpperCase()) {
            case "EQUALS" -> "get(\"" + field + "\").equalsIgnoreCase(\"" + value + "\")";
            case "NOT_EQUALS" -> "!get(\"" + field + "\").equalsIgnoreCase(\"" + value + "\")";
            case "CONTAINS" -> "get(\"" + field + "\").toLowerCase().contains(\"" + value.toLowerCase() + "\")";
            case "STARTS_WITH" -> "get(\"" + field + "\").toLowerCase().startsWith(\"" + value.toLowerCase() + "\")";
            case "ENDS_WITH" -> "get(\"" + field + "\").toLowerCase().endsWith(\"" + value.toLowerCase() + "\")";
            case "GREATER_THAN" ->
                "!isEmpty(\"" + field + "\") && Double.parseDouble(get(\"" + field + "\")) > " + value;
            case "LESS_THAN" -> "!isEmpty(\"" + field + "\") && Double.parseDouble(get(\"" + field + "\")) < " + value;
            case "GREATER_THAN_EQUAL" ->
                "!isEmpty(\"" + field + "\") && Double.parseDouble(get(\"" + field + "\")) >= " + value;
            case "LESS_THAN_EQUAL" ->
                "!isEmpty(\"" + field + "\") && Double.parseDouble(get(\"" + field + "\")) <= " + value;
            case "IS_EMPTY" -> "isEmpty(\"" + field + "\")";
            case "IS_NOT_EMPTY" -> "!isEmpty(\"" + field + "\")";
            case "IS_TRUE" ->
                "get(\"" + field + "\").equalsIgnoreCase(\"true\") || get(\"" + field
                        + "\").equalsIgnoreCase(\"yes\") || get(\"" + field + "\").equals(\"1\")";
            case "IS_FALSE" ->
                "get(\"" + field + "\").equalsIgnoreCase(\"false\") || get(\"" + field
                        + "\").equalsIgnoreCase(\"no\") || get(\"" + field + "\").equals(\"0\")";
            case "IN_LIST" ->
                "java.util.Arrays.asList(\"" + value + "\".split(\",\\\\s*\")).contains(get(\"" + field + "\"))";
            case "NOT_IN_LIST" ->
                "!java.util.Arrays.asList(\"" + value + "\".split(\",\\\\s*\")).contains(get(\"" + field + "\"))";
            case "MATCHES_REGEX" -> "!get(\"" + field + "\").matches(\"" + value + "\")";
            default -> null;
        };

    }

    /**
     * Translate a FormRule action into a Drools DRL then-block.
     */
    private String buildAction(FormRule rule) {
        String actionField = rule.getActionField() != null ? escapeDrl(rule.getActionField()) : "";
        String rawActionVal = rule.getActionValue();
        String displayMsg = (rawActionVal != null && !rawActionVal.isBlank()) ? rawActionVal : rule.getRuleName();
        String escapedMsg = escapeDrl(displayMsg);

        return switch (rule.getActionType().toUpperCase()) {
            case "REQUIRE" -> "    $fact.markRequired(\"" + actionField + "\");\n";
            case "REJECT" -> "    $fact.addError(\"" + escapedMsg + "\");\n";
            case "HIDE" -> "    $fact.hide(\"" + actionField + "\");\n";
            case "SHOW" -> "    // SHOW " + actionField + " (frontend hint)\n";
            case "SET_VALUE" -> "    $fact.setValue(\"" + actionField + "\", \"" + escapedMsg + "\");\n";
            case "SHOW_ERROR" -> "    $fact.addFieldError(\"" + actionField + "\", \"" + escapedMsg + "\");\n";
            case "DISABLE" -> "    $fact.disable(\"" + actionField + "\");\n";
            case "ENABLE" -> "    $fact.enable(\"" + actionField + "\");\n";
            case "CLEAR_VALUE" -> "    $fact.clearValue(\"" + actionField + "\");\n";
            case "COPY_VALUE" -> {
                String copyFrom = (rawActionVal != null) ? escapeDrl(rawActionVal) : "";
                yield "    $fact.setValue(\"" + actionField + "\", $fact.get(\"" + copyFrom + "\"));\n";
            }
            default -> "    // Unknown action: " + rule.getActionType() + "\n";
        };
    }

    /** Escape characters that would break DRL string literals */
    private String escapeDrl(String s) {
        if (s == null)
            return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "");
    }
}
