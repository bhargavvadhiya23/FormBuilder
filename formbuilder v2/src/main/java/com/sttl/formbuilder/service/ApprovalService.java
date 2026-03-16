package com.sttl.formbuilder.service;

import com.sttl.formbuilder.entity.ApprovalRequest;
import com.sttl.formbuilder.entity.ApprovalRequest.ApprovalStatus;
import com.sttl.formbuilder.entity.ApprovalRequest.ApprovalType;
import com.sttl.formbuilder.entity.User;
import com.sttl.formbuilder.repository.ApprovalRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Manages the lifecycle of admin-approval requests.
 * When a sub-user performs an action whose permission has requiresApproval=true,
 * this service creates an ApprovalRequest instead of executing the action immediately.
 */
@Service
@RequiredArgsConstructor
public class ApprovalService {

    private final ApprovalRequestRepository approvalRequestRepository;

    /**
     * Creates a pending approval request routed to the sub-user's admin.
     *
     * @param type        the type of action requested
     * @param referenceId the ID of the resource (e.g., form UUID as a String)
     * @param description a human-readable description of the request
     * @param requestedBy the sub-user who triggered the action
     * @return the saved ApprovalRequest
     */
    @Transactional
    public ApprovalRequest createRequest(ApprovalType type, String referenceId, String description, User requestedBy) {
        if (requestedBy.getCreatedByAdmin() == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Sub-user (ID: " + requestedBy.getId() + ") has no parent administrator associated — cannot route approval. Please contact your system administrator.");
        }

        // Search for existing pending request to update it instead of creating duplicate
        java.util.Optional<ApprovalRequest> existing = approvalRequestRepository.findByReferenceIdAndStatus(referenceId, ApprovalStatus.PENDING);
        if (existing.isPresent()) {
            ApprovalRequest req = existing.get();
            req.setDescription(description);
            req.setType(type);
            req.setRequestedBy(requestedBy); // Update requester in case it changed
            return approvalRequestRepository.save(req);
        }

        ApprovalRequest req = new ApprovalRequest();
        req.setType(type);
        req.setReferenceId(referenceId);
        req.setDescription(description);
        req.setRequestedBy(requestedBy);
        req.setRoutedToAdmin(requestedBy.getCreatedByAdmin());
        req.setStatus(ApprovalStatus.PENDING);
        return approvalRequestRepository.save(req);
    }

    /** All pending requests for a specific admin. */
    public List<ApprovalRequest> getPendingForAdmin(UUID adminId) {
        return approvalRequestRepository.findByRoutedToAdmin_IdAndStatus(adminId, ApprovalStatus.PENDING);
    }

    /** All requests (any status) for a specific admin. */
    public List<ApprovalRequest> getAllForAdmin(UUID adminId) {
        return approvalRequestRepository.findByRoutedToAdmin_Id(adminId);
    }

    /** All requests made by a specific sub-user. */
    public List<ApprovalRequest> getAllByRequester(UUID requesterId) {
        return approvalRequestRepository.findByRequestedBy_Id(requesterId);
    }

    /** All requests handled (resolved) by a specific admin. */
    public List<ApprovalRequest> getResolvedForAdmin(UUID adminId) {
        return approvalRequestRepository.findByRoutedToAdmin_IdAndStatusNot(adminId, ApprovalStatus.PENDING);
    }

    /** Approve a request. Executing the actual deferred action is the caller's responsibility. */
    @Transactional
    public ApprovalRequest approve(UUID requestId, User adminUser, String adminNote) {
        ApprovalRequest req = get(requestId);
        assertAdmin(req, adminUser);
        assertPending(req);

        req.setStatus(ApprovalStatus.APPROVED);
        req.setAdminNote(adminNote);
        req.setResolvedAt(LocalDateTime.now());
        return approvalRequestRepository.save(req);
    }

    /** Reject a request. */
    @Transactional
    public ApprovalRequest reject(UUID requestId, User adminUser, String adminNote) {
        ApprovalRequest req = get(requestId);
        assertAdmin(req, adminUser);
        assertPending(req);

        req.setStatus(ApprovalStatus.REJECTED);
        req.setAdminNote(adminNote);
        req.setResolvedAt(LocalDateTime.now());
        return approvalRequestRepository.save(req);
    }

    public ApprovalRequest get(UUID requestId) {
        return approvalRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Approval request not found"));
    }

    // ---- helpers ----

    private void assertAdmin(ApprovalRequest req, User adminUser) {
        if (!req.getRoutedToAdmin().getId().equals(adminUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This request is not routed to you");
        }
    }

    private void assertPending(ApprovalRequest req) {
        if (req.getStatus() != ApprovalStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This request has already been " + req.getStatus());
        }
    }
}
