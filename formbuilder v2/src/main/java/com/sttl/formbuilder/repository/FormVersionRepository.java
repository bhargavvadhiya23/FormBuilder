package com.sttl.formbuilder.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sttl.formbuilder.entity.FormVersion;

public interface FormVersionRepository extends JpaRepository<FormVersion, UUID> {

    Optional<FormVersion> findByFormIdAndStatus(UUID formId, String status);

    int countByFormIdAndStatus(UUID formId, String status);

    // Used to get the latest DRAFT or PUBLISHED version for a form
    Optional<FormVersion> findTopByFormIdAndStatus(UUID formId, String status);

    int countByFormId(UUID formId);

    List<FormVersion> findByFormId(UUID formId);

    // Global counts for dashboard stats
    long countByStatus(String status);

    // All published versions (to sum up submissions)
    List<FormVersion> findByStatus(String status);

    // User-specific counts and versions for dashboard
    long countByForm_CreatedBy_IdAndStatus(UUID userId, String status);

    List<FormVersion> findByForm_CreatedBy_IdAndStatus(UUID userId, String status);
}