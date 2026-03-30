package com.sttl.formbuilder.model;

import java.util.*;
import java.util.UUID;

/**
 * The "fact" object passed to the rule engine for each form
 * submission.
 * Rules read fieldValues, then append to errors / hidden / required /
 * updatedValues.
 */
public class SubmissionFact {

    private UUID formId;

    /** All submitted field values: fieldKey → value */
    private Map<String, String> fieldValues;

    /** Rules append error messages here. Non-empty = submission is rejected. */
    private List<String> errors = new ArrayList<>();

    /** Fields that rules mark as hidden (frontend hint) */
    private Set<String> hidden = new HashSet<>();

    /** Fields that rules dynamically mark as required */
    private Set<String> required = new HashSet<>();

    /** Fields that rules dynamically mark as disabled */
    private Set<String> disabled = new HashSet<>();

    /** Field-specific error messages */
    private Map<String, String> fieldErrors = new HashMap<>();

    /** Values that rules override (SET_VALUE / COPY_VALUE / CLEAR_VALUE action) */
    private Map<String, String> updatedValues = new HashMap<>();

    // ─── Constructors ────────────────────────────────────────────────────────

    public SubmissionFact() {
    }

    public SubmissionFact(UUID formId, Map<String, String> fieldValues) {
        this.formId = formId;
        this.fieldValues = new HashMap<>(fieldValues);
    }

    // ─── Helper methods (called from DRL rules) ──────────────────────────────

    /** Retrieve a field value (null-safe) */
    public String get(String fieldKey) {
        return fieldValues != null ? fieldValues.getOrDefault(fieldKey, "") : "";
    }

    /** Check if a field is blank/empty */
    public boolean isEmpty(String fieldKey) {
        String val = get(fieldKey);
        return val == null || val.isBlank();
    }

    /** Add a validation error to the whole submission */
    public void addError(String message) {
        errors.add(message);
    }

    /** Add a validation error to a specific field */
    public void addFieldError(String fieldKey, String message) {
        fieldErrors.put(fieldKey, message);
        errors.add(fieldKey + ": " + message); // Also add to main errors list so it rejects
    }

    /** Dynamically mark a field as required */
    public void markRequired(String fieldKey) {
        required.add(fieldKey);
    }

    /** Dynamically hide a field */
    public void hide(String fieldKey) {
        hidden.add(fieldKey);
    }

    /** Dynamically disable a field */
    public void disable(String fieldKey) {
        disabled.add(fieldKey);
    }

    /** Dynamically enable a field */
    public void enable(String fieldKey) {
        disabled.remove(fieldKey);
    }

    /** Override a field's value */
    public void setValue(String fieldKey, String value) {
        updatedValues.put(fieldKey, value);
        if (fieldValues != null)
            fieldValues.put(fieldKey, value);
    }

    /** Clear a field's value */
    public void clearValue(String fieldKey) {
        setValue(fieldKey, "");
    }

    // ─── Getters / Setters ───────────────────────────────────────────────────

    public UUID getFormId() {
        return formId;
    }

    public void setFormId(UUID formId) {
        this.formId = formId;
    }

    public Map<String, String> getFieldValues() {
        return fieldValues;
    }

    public void setFieldValues(Map<String, String> fieldValues) {
        this.fieldValues = fieldValues;
    }

    public List<String> getErrors() {
        return errors;
    }

    public void setErrors(List<String> errors) {
        this.errors = errors;
    }

    public Set<String> getHidden() {
        return hidden;
    }

    public void setHidden(Set<String> hidden) {
        this.hidden = hidden;
    }

    public Set<String> getRequired() {
        return required;
    }

    public void setRequired(Set<String> required) {
        this.required = required;
    }

    public Map<String, String> getUpdatedValues() {
        return updatedValues;
    }

    public void setUpdatedValues(Map<String, String> updatedValues) {
        this.updatedValues = updatedValues;
    }

    public boolean hasErrors() {
        return !errors.isEmpty();
    }
}
