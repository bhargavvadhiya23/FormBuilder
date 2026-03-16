package com.sttl.formbuilder.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Represents a deferred action that requires admin approval before execution.
 * Created when a sub-user performs an action whose permission has "requiresApproval=true".
 */
@Entity
@Table(name = "approval_requests")
@Data
public class ApprovalRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * Type of action that needs approval.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApprovalType type;

    /**
     * ID of the resource this request refers to (e.g., form UUID).
     */
    @Column(name = "reference_id", nullable = false)
    private String referenceId;

    /**
     * Human-readable description shown in the approvals inbox.
     */
    @Column(columnDefinition = "TEXT")
    private String description;

    /**
     * The sub-user who triggered this request.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by", nullable = false)
    private User requestedBy;

    /**
     * The admin who must approve or reject this request.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "routed_to_admin", nullable = false)
    private User routedToAdmin;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApprovalStatus status = ApprovalStatus.PENDING;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "admin_note", columnDefinition = "TEXT")
    private String adminNote;

    public enum ApprovalType {
        CREATE_FORM,          // Sub-user created a draft; admin can publish
        EDIT_PUBLISHED_FORM,  // Sub-user wants to edit a published form
        DELETE_PUBLISHED_FORM, // Sub-user wants to delete a published form
        DELETE_DRAFT_FORM,    // Sub-user wants to delete a draft form
        PUBLISH_FORM          // Sub-user wants to publish a draft
    }

    public enum ApprovalStatus {
        PENDING,
        APPROVED,
        REJECTED
    }
}
