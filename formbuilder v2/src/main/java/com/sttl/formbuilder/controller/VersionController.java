package com.sttl.formbuilder.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.sttl.formbuilder.entity.User;

import com.sttl.formbuilder.entity.FormField;
import com.sttl.formbuilder.entity.FormVersion;
import com.sttl.formbuilder.repository.FormFieldRepository;
import com.sttl.formbuilder.repository.FormVersionRepository;
import com.sttl.formbuilder.service.SchemaService;
import com.sttl.formbuilder.service.SubmissionService;

/**
 * Kept for backward compatibility.
 * New code should use /api/forms/{formId}/... endpoints in FormController.
 */
@RestController
@RequestMapping("/admin/api/versions")
public class VersionController {

    private final FormFieldRepository fieldRepository;
    private final FormVersionRepository versionRepository;
    private final SchemaService schemaService;
    private final SubmissionService submissionService;
    private final com.sttl.formbuilder.service.FormService formService;

    public VersionController(FormFieldRepository fieldRepository,
            FormVersionRepository versionRepository,
            SchemaService schemaService,
            SubmissionService submissionService,
            com.sttl.formbuilder.service.FormService formService) {
        this.fieldRepository = fieldRepository;
        this.versionRepository = versionRepository;
        this.schemaService = schemaService;
        this.submissionService = submissionService;
        this.formService = formService;
    }

    private void checkOwnership(UUID versionId, User user) {
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));
        formService.getFormByIdAndUserId(version.getForm().getId(), user.getId());
    }

    @GetMapping
    public ResponseEntity<List<FormVersion>> getAllVersions(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(versionRepository.findAll().stream()
                .filter(v -> v.getForm() != null && v.getForm().getCreatedBy() != null
                        && v.getForm().getCreatedBy().getId().equals(currentUser.getId()))
                .toList());
    }

    @GetMapping("/{versionId}")
    public ResponseEntity<FormVersion> getVersion(@PathVariable UUID versionId,
            @AuthenticationPrincipal User currentUser) {
        checkOwnership(versionId, currentUser);
        return ResponseEntity.ok(versionRepository.findById(versionId).get());
    }

    @GetMapping("/{versionId}/fields")
    public ResponseEntity<List<FormField>> getFields(@PathVariable UUID versionId,
            @AuthenticationPrincipal User currentUser) {
        checkOwnership(versionId, currentUser);
        return ResponseEntity.ok(fieldRepository.findByVersion_IdOrderByFieldOrder(versionId));
    }

    @PostMapping("/{versionId}/publish")
    public ResponseEntity<Map<String, String>> publish(@PathVariable UUID versionId,
            @AuthenticationPrincipal User currentUser) {
        checkOwnership(versionId, currentUser);
        schemaService.publishVersion(versionId);
        return ResponseEntity.ok(Map.of("message", "Published successfully"));
    }

    @GetMapping("/{versionId}/submissions")
    public ResponseEntity<List<Map<String, Object>>> getSubmissions(@PathVariable UUID versionId,
            @AuthenticationPrincipal User currentUser) {
        checkOwnership(versionId, currentUser);
        return ResponseEntity.ok(submissionService.getSubmissions(versionId));
    }
}