package com.sttl.formbuilder.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Stores a single business rule for a form.
 * Rules are evaluated at submission time by the rule engine.
 *
 * Example rule:
 * IF field 'country' EQUALS 'US' THEN REQUIRE field 'phone'
 */
@Data
@Entity
@Table(name = "form_rules")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class FormRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Which form this rule belongs to */
    @Column(nullable = false)
    private UUID formId;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    /** Human-readable name for the rule, e.g. "Require phone for US users" */
    @Column(nullable = false, length = 200)
    private String ruleName;

    /** Optional description */
    @Column(length = 500)
    private String description;

    // ─── Condition (IF side) ─────────────────────────────────────────────────

    /** The field key to check in the condition, e.g. "country" (LEAVE FOR MIGRATION) */
    @Column(length = 100)
    private String conditionField;

    /**
     * Operator: EQUALS | NOT_EQUALS | CONTAINS | STARTS_WITH | ENDS_WITH |
     * GREATER_THAN | LESS_THAN | IS_EMPTY | IS_NOT_EMPTY | ALWAYS (LEAVE FOR MIGRATION)
     */
    @Column(length = 30)
    private String conditionOperator;

    /**
     * The value to compare against, e.g. "US" (LEAVE FOR MIGRATION)
     */
    @Column(length = 500)
    private String conditionValue;

    /** The new boolean expression for the condition, e.g. "age >= 18 && country == \"US\"" */
    @Column(columnDefinition = "TEXT")
    private String conditionExpression;

    // ─── Action (THEN side) ──────────────────────────────────────────────────

    /**
     * What to do when the condition is met:
     * REQUIRE – mark actionField as required (reject if empty)
     * REJECT – reject the whole submission with actionValue as the error message
     * SHOW – mark actionField as visible (frontend hint)
     * HIDE – mark actionField as hidden (frontend hint)
     * SET_VALUE – set actionField to actionValue
     * CALCULATE – set actionField to result of actionExpression
     */
    @Column(nullable = false, length = 30)
    private String actionType;
    
    /** The expression to evaluate for CALCULATE action */
    @Column(columnDefinition = "TEXT")
    private String actionExpression;

    /** The field key that the action targets (not needed for REJECT) */
    @Column(length = 100)
    private String actionField;

    /**
     * The value used by the action (error message for REJECT, value for SET_VALUE)
     */
    @Column(length = 500)
    private String actionValue;

    /** Rule execution order (lower = earlier), default 100 */
    @Column(nullable = false)
    private Integer priority = 100;

    /** Whether this rule is active */
    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
