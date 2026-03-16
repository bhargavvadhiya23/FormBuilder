package com.sttl.formbuilder.repository;

import com.sttl.formbuilder.entity.ApprovalRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, UUID> {

    /** All pending requests routed to a specific admin. */
    List<ApprovalRequest> findByRoutedToAdmin_IdAndStatus(UUID adminId, ApprovalRequest.ApprovalStatus status);

    /** All requests routed to a specific admin (any status). */
    List<ApprovalRequest> findByRoutedToAdmin_Id(UUID adminId);

    /** Requests made by a specific sub-user. */
    List<ApprovalRequest> findByRequestedBy_Id(UUID userId);

    /** All resolved (non-pending) requests routed to a specific admin. */
    List<ApprovalRequest> findByRoutedToAdmin_IdAndStatusNot(UUID adminId, ApprovalRequest.ApprovalStatus status);

    /** Check if a pending request exists for a reference. */
    boolean existsByReferenceIdAndStatus(String referenceId, ApprovalRequest.ApprovalStatus status);

    /** Find a pending request by reference ID. */
    java.util.Optional<ApprovalRequest> findByReferenceIdAndStatus(String referenceId, ApprovalRequest.ApprovalStatus status);

    /** Find the latest resolved request for a reference. */
    java.util.Optional<ApprovalRequest> findFirstByReferenceIdAndStatusNotOrderByResolvedAtDesc(String referenceId, ApprovalRequest.ApprovalStatus status);
}
