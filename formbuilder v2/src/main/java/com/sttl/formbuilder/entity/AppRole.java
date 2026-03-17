package com.sttl.formbuilder.entity;

import com.sttl.formbuilder.Enums.Permission;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * A dynamic role that the Admin can create and assign permissions to.
 * Two system roles ("Admin" and "User") are seeded on startup and cannot be
 * edited or deleted (isSystem = true).
 */
@Entity
@Table(name = "app_roles")
@Data
public class AppRole {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Human-readable name, e.g. "Editor", "Reviewer". */
    @Column(nullable = false, unique = true, length = 100)
    private String name;

    /**
     * True for the two built-in roles ("Admin" and "User").
     * System roles cannot be edited or deleted.
     */
    @Column(name = "is_system", nullable = false)
    private boolean isSystem = false;

    /**
     * The admin who created this role.
     * Null for system roles.
     */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_admin")
    private User createdByAdmin;

    /**
     * The set of permissions granted to users with this role.
     * Stored as strings in a join table.
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "app_role_permissions", joinColumns = @JoinColumn(name = "app_role_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "permission")
    private Set<Permission> permissions = new HashSet<>();

    /**
     * Whether any of the permissions with special behaviour require admin approval.
     * This is stored as a JSON string mapping Permission name → boolean.
     * Example: {"CREATE_DRAFT_FORM":true,"DELETE_PUBLISHED_FORM":false}
     */
    @Column(name = "approval_required_map", columnDefinition = "TEXT")
    private String approvalRequiredMap = "{}";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /**
     * Dynamic modules assigned to this role.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "app_role_modules",
            joinColumns = @JoinColumn(name = "app_role_id"),
            inverseJoinColumns = @JoinColumn(name = "module_id")
    )
    private Set<Module> modules = new HashSet<>();
}
