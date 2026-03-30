package com.sttl.formbuilder.controller;

import com.sttl.formbuilder.entity.Form;
import com.sttl.formbuilder.entity.FormField;
import com.sttl.formbuilder.entity.FormVersion;
import com.sttl.formbuilder.repository.FormFieldRepository;
import com.sttl.formbuilder.service.FormService;
import com.sttl.formbuilder.service.SubmissionService;
import com.sttl.formbuilder.service.RuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/publish")
@RequiredArgsConstructor
@org.springframework.transaction.annotation.Transactional
public class PublicFormController {

    private final FormService formService;
    private final FormFieldRepository fieldRepository;
    private final SubmissionService submissionService;
    private final RuleService ruleService;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    /**
     * Returns the published version info + fields — used by public fill page.
     * Accessible without authentication.
     */
    @GetMapping("/{formId}/published")
    public ResponseEntity<Map<String, Object>> getPublishedForm(@PathVariable UUID formId) {
        try {
            Form form = formService.getFormById(formId, true); // Fetch even if deleted to handle it specifically
            
            if (form.isDeleted()) {
                java.util.Map<String, Object> error = new java.util.HashMap<>();
                error.put("deleted", true);
                error.put("message", "This form has been deleted.");
                return ResponseEntity.status(410).body(error); // 410 Gone
            }

            FormVersion version = formService.getPublishedVersion(formId)
                    .orElseThrow(() -> new RuntimeException("This form is not published"));

            if (form.getUnpublishTime() != null && java.time.LocalDateTime.now().isAfter(form.getUnpublishTime())) {
                java.util.Map<String, Object> error = new java.util.HashMap<>();
                error.put("closed", true);
                error.put("message", "This form has been closed by the admin.");
                return ResponseEntity.status(403).body(error);
            }

            List<FormField> fields = fieldRepository.findByVersion_IdOrderByFieldOrder(version.getId());

            Long existingSubmissionId = submissionService.getUserSubmissionId(version.getId());

            java.util.Map<String, Object> formMap = new java.util.HashMap<>();
            formMap.put("id", form.getId());
            formMap.put("name", form.getName());
            formMap.put("description", form.getDescription());
            formMap.put("oneSubmissionPerUser", form.getOneSubmissionPerUser());

            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("form", formMap);
            response.put("versionId", version.getId());
            response.put("fields", fields);
            response.put("alreadySubmitted", existingSubmissionId != null);
            response.put("submissionId", existingSubmissionId != null ? existingSubmissionId : "");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("ERROR: Failed to fetch published form " + formId + ": " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    /**
     * Returns the rules for the published form.
     * Accessible without authentication.
     */
    @GetMapping("/{formId}/rules")
    public ResponseEntity<List<com.sttl.formbuilder.entity.FormRule>> getRules(@PathVariable UUID formId) {
        // Only return rules if the form is published
        formService.getPublishedVersion(formId)
                .orElseThrow(() -> new RuntimeException("This form is not published"));
        return ResponseEntity.ok(ruleService.getRulesForForm(formId));
    }

    /**
     * Returns dynamic options for a field in the published form.
     * Accessible without authentication.
     */
    @GetMapping("/{formId}/fields/{fieldKey}/options")
    public ResponseEntity<List<?>> getFieldOptions(@PathVariable UUID formId, @PathVariable String fieldKey) {
        FormVersion version = formService.getPublishedVersion(formId)
                .orElseThrow(() -> new RuntimeException("This form is not published"));

        FormField field = fieldRepository.findByVersion_IdAndFieldKey(version.getId(), fieldKey)
                .orElseThrow(() -> new RuntimeException("Field not found"));

        if (field.getDataSourceTable() != null && field.getDataSourceColumn() != null) {
            String table = field.getDataSourceTable();
            String column = field.getDataSourceColumn();
            if (!table.matches("^[a-zA-Z0-9_]+$") || !column.matches("^[a-zA-Z0-9_]+$")) {
                throw new RuntimeException("Invalid table or column name");
            }
            // Return both ID and the column value for "Call by Reference"
            String sql = "SELECT \"id\", \"" + column + "\" as label FROM \"" + table + "\" WHERE \"" + column
                    + "\" IS NOT NULL ORDER BY \"" + column + "\"";
            return ResponseEntity.ok(jdbcTemplate.queryForList(sql));
        }

        if (field.getOptions() != null) {
            try {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                List<String> options = mapper.readValue(field.getOptions(),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {
                        });
                return ResponseEntity.ok(options);
            } catch (Exception e) {
                return ResponseEntity.ok(List.of());
            }
        }
        return ResponseEntity.ok(List.of());
    }

    /**
     * Submit a form response.
     * Accessible without authentication.
     */
    @PostMapping("/{formId}/submit")
    public ResponseEntity<Map<String, Object>> submit(@PathVariable UUID formId,
            @RequestBody Map<String, Object> data) {
        FormVersion version = formService.getPublishedVersion(formId)
                .orElseThrow(() -> new RuntimeException("This form is not published"));

        Long submissionId = submissionService.submitForm(version.getId(), data);
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("message", "Response submitted successfully!");
        response.put("submissionId", submissionId != null ? submissionId : "");
        return ResponseEntity.ok(response);
    }

    /**
     * Get a specific submission (for editing).
     */
    @GetMapping("/{formId}/submissions/{submissionId}")
    public ResponseEntity<Map<String, Object>> getSubmission(
            @PathVariable UUID formId,
            @PathVariable Long submissionId) {
        FormVersion version = formService.getPublishedVersion(formId)
                .orElseThrow(() -> new RuntimeException("This form is not published"));

        return ResponseEntity.ok(submissionService.getSubmission(version.getId(), submissionId));
    }

    /**
     * Update an existing submission.
     */
    @PutMapping("/{formId}/submissions/{submissionId}")
    public ResponseEntity<Map<String, String>> updateSubmission(
            @PathVariable UUID formId,
            @PathVariable Long submissionId,
            @RequestBody Map<String, Object> data) {
        FormVersion version = formService.getPublishedVersion(formId)
                .orElseThrow(() -> new RuntimeException("This form is not published"));

        submissionService.updateSubmission(version.getId(), submissionId, data);
        java.util.Map<String, String> response = new java.util.HashMap<>();
        response.put("message", "Response updated successfully!");
        return ResponseEntity.ok(response);
    }

    /**
     * Check form status (published or not).
     * Accessible without authentication.
     */
    @GetMapping("/{formId}/status")
    public ResponseEntity<Map<String, Object>> getFormStatus(@PathVariable UUID formId) {
        boolean published = formService.isPublished(formId);
        Map<String, Object> status = new java.util.HashMap<>();

        try {
            Form form = formService.getFormById(formId, true);
            if (form.isDeleted()) {
                status.put("deleted", true);
                status.put("message", "This form has been deleted.");
                return ResponseEntity.ok(status);
            }
            
            if (published) {
                FormVersion version = formService.getPublishedVersion(formId).orElse(null);
                if (version != null && version.getForm().getUnpublishTime() != null
                        && java.time.LocalDateTime.now().isAfter(version.getForm().getUnpublishTime())) {
                    status.put("closed", true);
                    status.put("message", "This form has been closed by the admin.");
                    return ResponseEntity.ok(status);
                }
            }
        } catch (Exception e) {
            status.put("error", e.getMessage());
        }

        status.put("published", published);
        status.put("hasDraft", formService.getDraftVersion(formId).isPresent());
        status.put("shareLink", published ? "/publish/" + formId : null);
        return ResponseEntity.ok(status);
    }
}
