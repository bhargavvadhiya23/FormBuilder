package com.sttl.formbuilder.controller;

import com.sttl.formbuilder.service.ApprovalService;
import com.sttl.formbuilder.service.FormService;
import com.sttl.formbuilder.service.UserService;
import com.sttl.formbuilder.entity.ApprovalRequest;
import com.sttl.formbuilder.entity.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Admin inbox for approval requests.
 * All endpoints are under /admin path and require ROLE_ADMIN.
 */
@RestController
@RequestMapping("${api.base-path}/admin/approvals")
@org.springframework.transaction.annotation.Transactional
public class ApprovalController {

    private final ApprovalService approvalService;
    private final FormService formService;
    private final UserService userService;

    public ApprovalController(ApprovalService approvalService,
                              FormService formService,
                              UserService userService) {
        this.approvalService = approvalService;
        this.formService = formService;
        this.userService = userService;
    }

    /** List all approval requests for the current admin (default: pending only). */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getApprovals(
            @RequestParam(defaultValue = "PENDING") String status,
            @AuthenticationPrincipal User adminUserPrincipal) {
        User adminUser = userService.getUserById(adminUserPrincipal.getId());
        List<ApprovalRequest> requests;
        if ("ALL".equalsIgnoreCase(status)) {
            requests = approvalService.getAllForAdmin(adminUser.getId());
        } else {
            requests = approvalService.getPendingForAdmin(adminUser.getId());
        }
        return ResponseEntity.ok(requests.stream().map(this::toMap).toList());
    }

    /** List all requests made by the current authenticated user (sub-user) or handled by the current user (admin). */
    @GetMapping("/my-requests")
    public ResponseEntity<List<Map<String, Object>>> getMyRequests(
            @AuthenticationPrincipal User currentUserPrincipal) {
        User currentUser = userService.getUserById(currentUserPrincipal.getId());
        List<ApprovalRequest> requests;
        
        if ("ADMIN".equalsIgnoreCase(currentUser.getRole().name())) {
            // For Admin, "My Requests" means "Requests I've already handled/resolved"
            requests = approvalService.getResolvedForAdmin(currentUser.getId());
        } else {
            // For Sub-user, "My Requests" means "Requests I've made"
            requests = approvalService.getAllByRequester(currentUser.getId());
        }
        
        return ResponseEntity.ok(requests.stream().map(this::toMap).toList());
    }

    /** Approve a request. May trigger the deferred action (e.g., publish a form). */
    @PostMapping("/{requestId}/approve")
    public ResponseEntity<?> approve(
            @PathVariable UUID requestId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal User adminUserPrincipal) {
        User adminUser = userService.getUserById(adminUserPrincipal.getId());
        try {
            String note = body != null ? (String) body.get("adminNote") : null;
            ApprovalRequest req = approvalService.approve(requestId, adminUser, note);

            // Execute the deferred action
            executeDeferredAction(req, adminUser);

            return ResponseEntity.ok(Map.of("message", "Request approved", "request", toMap(req)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /** Reject a request. */
    @PostMapping("/{requestId}/reject")
    public ResponseEntity<?> reject(
            @PathVariable UUID requestId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal User adminUserPrincipal) {
        User adminUser = userService.getUserById(adminUserPrincipal.getId());
        try {
            String note = body != null ? (String) body.get("adminNote") : null;
            ApprovalRequest req = approvalService.reject(requestId, adminUser, note);
            return ResponseEntity.ok(Map.of("message", "Request rejected", "request", toMap(req)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // ---- helpers ----

    private void executeDeferredAction(ApprovalRequest req, User adminUser) {
        UUID formId;
        switch (req.getType()) {
            case CREATE_FORM, PUBLISH_FORM -> {
                // Admin publishes the form created by the sub-user
                formId = UUID.fromString(req.getReferenceId());
                formService.publishFormByAdmin(formId, adminUser);
            }
            case DELETE_PUBLISHED_FORM, DELETE_DRAFT_FORM -> {
                // Admin hard-deletes the form
                formId = UUID.fromString(req.getReferenceId());
                formService.deleteFormByAdmin(formId);
            }
            case EDIT_PUBLISHED_FORM -> {
                // Edit approval just gives the green light; sub-user re-submits their edits
                // No automatic action needed — the UI handles the re-submit flow
            }
        }
    }

    private Map<String, Object> toMap(ApprovalRequest req) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", req.getId());
        m.put("type", req.getType().name());
        m.put("referenceId", req.getReferenceId());

        // Fetch Form Name for UI convenience
        String referenceName = "Unknown";
        try {
            UUID formId = UUID.fromString(req.getReferenceId());
            Optional<com.sttl.formbuilder.entity.Form> formOpt = formService.findFormById(formId);
            if (formOpt.isPresent()) {
                referenceName = formOpt.get().getName();
            }
        } catch (Exception e) {
            // Not a UUID or form not found
        }
        m.put("referenceName", referenceName);

        m.put("description", req.getDescription());
        m.put("status", req.getStatus().name());
        m.put("requestedBy", req.getRequestedBy() != null
                ? Map.of("id", req.getRequestedBy().getId(), "name", req.getRequestedBy().getName(), "email", req.getRequestedBy().getEmail())
                : null);
        m.put("createdAt", req.getCreatedAt());
        m.put("resolvedAt", req.getResolvedAt());
        m.put("adminNote", req.getAdminNote());
        return m;
    }
}
