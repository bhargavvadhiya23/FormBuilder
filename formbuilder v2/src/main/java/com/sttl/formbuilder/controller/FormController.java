package com.sttl.formbuilder.controller;

import com.sttl.formbuilder.repository.ApprovalRequestRepository;
// import com.sttl.formbuilder.entity.ApprovalRequest;
import java.util.Optional;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import com.sttl.formbuilder.dto.AddFieldRequest;
import com.sttl.formbuilder.dto.CreateFormRequest;
import com.sttl.formbuilder.entity.Form;
import com.sttl.formbuilder.entity.FormField;
import com.sttl.formbuilder.entity.FormVersion;
import com.sttl.formbuilder.entity.User;
import com.sttl.formbuilder.repository.FormFieldRepository;
import com.sttl.formbuilder.repository.FormVersionRepository;
import com.sttl.formbuilder.service.FormService;
import com.sttl.formbuilder.service.SchemaService;
import com.sttl.formbuilder.service.SubmissionService;
import com.sttl.formbuilder.util.InputSanitizer;
import com.sttl.formbuilder.util.SqlTypeMapper;
import jakarta.validation.Valid;

import com.sttl.formbuilder.Enums.Permission;
import com.sttl.formbuilder.Enums.Role;
import com.sttl.formbuilder.service.PermissionService;
import com.sttl.formbuilder.service.ApprovalService;
import com.sttl.formbuilder.entity.ApprovalRequest;

@RestController
@RequestMapping({"/admin/api/forms", "/api/forms"})
@org.springframework.transaction.annotation.Transactional
public class FormController {

        private final FormService formService;
        private final FormVersionRepository versionRepository;
        private final FormFieldRepository fieldRepository;
        private final SchemaService schemaService;
        private final SubmissionService submissionService;
        private final JdbcTemplate jdbcTemplate;
        private final PermissionService permissionService;
        private final ApprovalService approvalService;
        private final com.sttl.formbuilder.service.UserService userService;
        private final ApprovalRequestRepository approvalRequestRepository;

        public FormController(FormService formService,
                        FormVersionRepository versionRepository,
                        FormFieldRepository fieldRepository,
                        SchemaService schemaService,
                        SubmissionService submissionService,
                        JdbcTemplate jdbcTemplate,
                        PermissionService permissionService,
                        ApprovalService approvalService,
                        com.sttl.formbuilder.service.UserService userService,
                        ApprovalRequestRepository approvalRequestRepository) {
                this.formService = formService;
                this.versionRepository = versionRepository;
                this.fieldRepository = fieldRepository;
                this.schemaService = schemaService;
                this.submissionService = submissionService;
                this.jdbcTemplate = jdbcTemplate;
                this.permissionService = permissionService;
                this.approvalService = approvalService;
                this.userService = userService;
                this.approvalRequestRepository = approvalRequestRepository;
        }

        // ─── Forms ───────────────────────────────────────────────────────────────

        @GetMapping
        public ResponseEntity<List<Map<String, Object>>> getAllForms(@AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                List<Form> forms = formService.getFormsByUserId(currentUser.getId());
                System.out.println("DEBUG: Found " + forms.size() + " active forms for user " + currentUser.getId());
                List<Map<String, Object>> result = forms.stream().map(f -> {
                        Map<String, Object> map = new java.util.HashMap<>();
                        map.put("id", f.getId());
                        map.put("name", f.getName());
                        map.put("description", f.getDescription());
                        map.put("createdAt", f.getCreatedAt());

                        // Status reporting
                        boolean pub = formService.isPublished(f.getId());
                        boolean hasDraft = formService.getDraftVersion(f.getId()).isPresent();
                        map.put("published", pub);
                        map.put("hasDraft", hasDraft);
                        map.put("shareLink", pub ? "/publish/" + f.getId() : null);
                        
                        if (f.getCreatedBy() != null) {
                            Map<String, String> creator = new java.util.HashMap<>();
                            creator.put("name", f.getCreatedBy().getName());
                            creator.put("email", f.getCreatedBy().getEmail());
                            map.put("createdBy", creator);
                        }
                        return map;
                }).toList();
                return ResponseEntity.ok(result);
        }

        @GetMapping("/trash")
        public ResponseEntity<List<Map<String, Object>>> getTrashForms(@AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                List<Form> forms = formService.getTrashForms(currentUser.getId());
                System.out.println("DEBUG: Found " + forms.size() + " trash forms for user " + currentUser.getId());
                List<Map<String, Object>> result = forms.stream().map(f -> {
                        System.out.println("DEBUG: Trash Form: ID=" + f.getId() + ", Name=" + f.getName() + ", Deleted="
                                        + f.isDeleted());
                        Map<String, Object> map = new java.util.HashMap<>();
                        map.put("id", f.getId());
                        map.put("name", f.getName());
                        map.put("description", f.getDescription());
                        map.put("createdAt", f.getCreatedAt());

                        // Status reporting
                        boolean pub = formService.isPublished(f.getId());
                        boolean hasDraft = formService.getDraftVersion(f.getId()).isPresent();
                        map.put("published", pub);
                        map.put("hasDraft", hasDraft);
                        
                        if (f.getCreatedBy() != null) {
                            Map<String, String> creator = new java.util.HashMap<>();
                            creator.put("name", f.getCreatedBy().getName());
                            creator.put("email", f.getCreatedBy().getEmail());
                            map.put("createdBy", creator);
                        }
                        return map;
                }).toList();
                return ResponseEntity.ok(result);
        }

        @PostMapping("/{formId}/recover")
        public ResponseEntity<Form> recoverForm(@PathVariable UUID formId,
                        @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                return ResponseEntity.ok(formService.recoverForm(formId, currentUser.getId()));
        }

        @DeleteMapping("/{formId}")
        public ResponseEntity<?> deleteForm(@PathVariable UUID formId, @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                if (currentUser.getRole() == Role.USER) {
                        boolean isPublished = formService.isPublished(formId);
                        Permission requiredPerm = isPublished ? Permission.DELETE_PUBLISHED_FORM : Permission.DELETE_DRAFT_FORM;

                        if (!permissionService.hasPermission(currentUser, requiredPerm)) {
                                return ResponseEntity.status(403).body(Map.of("message", "You do not have permission to delete this form."));
                        }

                        // Sub-users must ALWAYS go through the approval workflow to delete a form.
                        approvalService.createRequest(ApprovalRequest.ApprovalType.valueOf(requiredPerm.name()), formId.toString(), "Delete form request", currentUser);
                        return ResponseEntity.accepted().body(Map.of("message", "Request sent to admin for approval."));
                }

                // For deletion, we use allowDeleted=true so that we can verify ownership
                // even if the form is already in the trash (for permanent delete)
                formService.getFormByIdAndUserId(formId, currentUser.getId(), true);
                formService.deleteForm(formId);
                return ResponseEntity.ok(Map.of("message", "Form deleted."));
        }

        @DeleteMapping("/bulk")
        public ResponseEntity<?> bulkDeleteForms(@RequestBody List<UUID> formIds,
                        @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());

                if (currentUser.getRole() == Role.USER) {
                        for (UUID formId : formIds) {
                                boolean isPublished = formService.isPublished(formId);
                                Permission requiredPerm = isPublished ? Permission.DELETE_PUBLISHED_FORM : Permission.DELETE_DRAFT_FORM;

                                if (permissionService.hasPermission(currentUser, requiredPerm)) {
                                        approvalService.createRequest(ApprovalRequest.ApprovalType.valueOf(requiredPerm.name()), formId.toString(), "Bulk delete request", currentUser);
                                }
                        }
                        return ResponseEntity.accepted().body(Map.of("message", "Requests sent to admin for approval."));
                }

                formService.bulkDeleteForms(formIds, currentUser.getId());
                return ResponseEntity.ok(Map.of("message", "Forms deleted successfully."));
        }

        @PostMapping("/bulk/recover")
        public ResponseEntity<Void> bulkRecoverForms(@RequestBody List<UUID> formIds,
                        @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                formService.bulkRecoverForms(formIds, currentUser.getId());
                return ResponseEntity.ok().build();
        }

        @GetMapping("/stats")
        public ResponseEntity<Map<String, Object>> getDashboardStats(@AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                long draftVersions = versionRepository.countByForm_CreatedBy_IdAndStatus(currentUser.getId(), "DRAFT");
                long publishedVersions = versionRepository.countByForm_CreatedBy_IdAndStatus(currentUser.getId(),
                                "PUBLISHED");
                long totalSubmissions = submissionService.getTotalSubmissions(currentUser.getId());
                Map<String, Object> stats = new java.util.HashMap<>();
                stats.put("draftVersions", draftVersions);
                stats.put("publishedVersions", publishedVersions);
                stats.put("totalSubmissions", totalSubmissions);
                return ResponseEntity.ok(stats);
        }

        @GetMapping("/{formId}")
        public ResponseEntity<Form> getForm(@PathVariable UUID formId, @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                return ResponseEntity.ok(formService.getFormByIdAndUserId(formId, currentUser.getId()));
        }

        @PostMapping
        public ResponseEntity<?> createForm(@Valid @RequestBody CreateFormRequest request,
                        @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                
                if (currentUser.getRole() == Role.USER) {
                        if (!permissionService.hasPermission(currentUser, Permission.CREATE_DRAFT_FORM)) {
                                java.util.Map<String, String> error = new java.util.HashMap<>();
                                error.put("message", "You do not have permission to create forms.");
                                return ResponseEntity.status(403).body(error);
                        }
                }

                Form form = formService.createFormWithVersion(request.getName(), request.getDescription(), currentUser);

                if (currentUser.getRole() == Role.USER && permissionService.requiresApproval(currentUser, Permission.CREATE_DRAFT_FORM)) {
                        approvalService.createRequest(ApprovalRequest.ApprovalType.CREATE_FORM, form.getId().toString(), "Create form request", currentUser);
                }

                return ResponseEntity.ok(form);
        }

        @PutMapping("/{formId}")
        public ResponseEntity<?> updateForm(@PathVariable UUID formId,
                        @Valid @RequestBody CreateFormRequest request, @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                if (currentUser.getRole() == Role.USER) {
                        boolean isPublished = formService.isPublished(formId);
                        Permission requiredPerm = isPublished ? Permission.EDIT_PUBLISHED_FORM : Permission.EDIT_DRAFT_FORM;

                        if (!permissionService.hasPermission(currentUser, requiredPerm)) {
                                return ResponseEntity.status(403).body(Map.of("message", "You do not have permission to edit this form."));
                        }

                        if (permissionService.requiresApproval(currentUser, requiredPerm)) {
                                approvalService.createRequest(ApprovalRequest.ApprovalType.valueOf(requiredPerm.name()), formId.toString(), "Edit form metadata request", currentUser);
                                return ResponseEntity.accepted().body(Map.of("message", "Request sent to admin for approval."));
                        }
                }

                formService.getFormByIdAndUserId(formId, currentUser.getId());
                return ResponseEntity.ok(
                                formService.updateForm(formId, request.getName(), request.getDescription(),
                                                request.getOneSubmissionPerUser(), request.getUnpublishTime()));
        }

        // ─── Fields ──────────────────────────────────────────────────────────────

        @GetMapping("/{formId}/fields")
        public ResponseEntity<List<FormField>> getFields(@PathVariable UUID formId,
                        @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                formService.getFormByIdAndUserId(formId, currentUser.getId());
                FormVersion version = formService.getDraftVersion(formId)
                                .or(() -> formService.getPublishedVersion(formId))
                                .orElseThrow(() -> new RuntimeException("No version found for form " + formId));
                return ResponseEntity.ok(
                                fieldRepository.findByVersion_IdOrderByFieldOrder(version.getId()));
        }

        @PostMapping("/{formId}/fields")
        public ResponseEntity<?> addField(@PathVariable UUID formId,
                        @Valid @RequestBody AddFieldRequest req, @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                if (currentUser.getRole() == Role.USER) {
                        boolean isPublished = formService.isPublished(formId);
                        Permission requiredPerm = isPublished ? Permission.EDIT_PUBLISHED_FORM : Permission.EDIT_DRAFT_FORM;

                        if (!permissionService.hasPermission(currentUser, requiredPerm)) {
                                return ResponseEntity.status(403).body(Map.of("message", "You do not have permission to edit fields."));
                        }

                        if (permissionService.requiresApproval(currentUser, requiredPerm)) {
                                approvalService.createRequest(ApprovalRequest.ApprovalType.valueOf(requiredPerm.name()), formId.toString(), "Add field request", currentUser);
                                return ResponseEntity.accepted().body(Map.of("message", "Request sent to admin for approval."));
                        }
                }

                Form form = formService.getFormByIdAndUserId(formId, currentUser.getId());
                FormVersion version = formService.ensureEditableDraft(formId, currentUser);
                
                // ─── Guardrails: Max Fields & Sections ───────────────────────────
                long fieldCount = fieldRepository.countByVersion_Id(version.getId());
                if (fieldCount >= 50) {
                    throw new IllegalArgumentException("Maximum of 50 fields allowed per form.");
                }
                if ("PAGE_BREAK".equalsIgnoreCase(req.getFieldType())) {
                    long pageCount = fieldRepository.countByVersion_IdAndFieldType(version.getId(), "PAGE_BREAK");
                    if (pageCount >= 10) {
                        throw new IllegalArgumentException("Maximum of 10 pages/sections allowed per form.");
                    }
                }
                // ─────────────────────────────────────────────────────────────────

                // Touch form timestamp
                form.setUpdatedAt(java.time.LocalDateTime.now());
                formService.saveForm(form);

                // Validate field type
                SqlTypeMapper.map(req.getFieldType());

                // Validate constraints
                validateFieldConstraints(req);

                // Sanitize or Generate key
                String safeKey;
                if (req.getFieldKey() == null || req.getFieldKey().isBlank()) {
                        safeKey = InputSanitizer.generateSafeKey(req.getFieldLabel());
                } else {
                        safeKey = InputSanitizer.sanitizeFieldKey(req.getFieldKey());
                }

                // Ensure uniqueness within version
                String baseKey = safeKey;
                int counter = 1;
                while (fieldRepository.existsByVersion_IdAndFieldKey(version.getId(), safeKey)) {
                        safeKey = baseKey + "_" + counter++;
                }

                FormField field = new FormField();
                field.setVersion(version);
                field.setFieldKey(safeKey);
                try {
                        field.setFieldLabel(InputSanitizer.sanitizeText(req.getFieldLabel(), 300));
                } catch (RuntimeException e) {
                        throw new RuntimeException("Question label " + e.getMessage());
                }
                field.setFieldType(req.getFieldType().toUpperCase());
                field.setRequired(req.getRequired());
                field.setFieldOrder(req.getFieldOrder());
                try {
                        field.setHelpText(req.getHelpText() != null
                                        ? InputSanitizer.sanitizeText(req.getHelpText(), 500)
                                        : null);
                } catch (RuntimeException e) {
                        throw new RuntimeException("Help text " + e.getMessage());
                }

                if (req.getOptions() != null) {
                        try {
                                ObjectMapper mapper = new ObjectMapper();
                                Object cleanOpts = InputSanitizer.sanitizeOptions(req.getOptions());
                                field.setOptions(mapper.writeValueAsString(cleanOpts));
                        } catch (Exception e) {
                                throw new RuntimeException("Failed to serialize options: " + e.getMessage());
                        }
                }

                field.setMinValue(req.getMinValue());
                field.setMaxValue(req.getMaxValue());
                try {
                        field.setMinLabel(
                                        req.getMinLabel() != null ? InputSanitizer.sanitizeText(req.getMinLabel(), 100)
                                                        : null);
                } catch (RuntimeException e) {
                        throw new RuntimeException("Min label " + e.getMessage());
                }
                try {
                        field.setMaxLabel(
                                        req.getMaxLabel() != null ? InputSanitizer.sanitizeText(req.getMaxLabel(), 100)
                                                        : null);
                } catch (RuntimeException e) {
                        throw new RuntimeException("Max label " + e.getMessage());
                }

                field.setMinValueStr(req.getMinValueStr() != null && !req.getMinValueStr().isBlank()
                                ? req.getMinValueStr().trim()
                                : null);
                field.setMaxValueStr(req.getMaxValueStr() != null && !req.getMaxValueStr().isBlank()
                                ? req.getMaxValueStr().trim()
                                : null);

                field.setCharType(req.getCharType() != null && !req.getCharType().isBlank()
                                ? req.getCharType().trim().toUpperCase()
                                : null);
                field.setMinLength(req.getMinLength());
                field.setMaxLength(req.getMaxLength());
                field.setTrimWhitespace(req.getTrimWhitespace() != null ? req.getTrimWhitespace() : true);
                field.setRemoveExtraSpaces(req.getRemoveExtraSpaces() != null ? req.getRemoveExtraSpaces() : true);
                field.setAllowSpecialChars(req.getAllowSpecialChars() != null ? req.getAllowSpecialChars() : true);
                field.setCustomRegex(req.getCustomRegex() != null && !req.getCustomRegex().isBlank()
                                ? req.getCustomRegex().trim()
                                : null);
                field.setAllowedFileTypes(req.getAllowedFileTypes() != null && !req.getAllowedFileTypes().isBlank()
                                ? req.getAllowedFileTypes().trim()
                                : null);
                field.setDataSourceTable(req.getDataSourceTable());
                field.setDataSourceColumn(req.getDataSourceColumn());
                field.setIsUnique(req.getIsUnique() != null ? req.getIsUnique() : false);

                return ResponseEntity.ok(fieldRepository.save(field));
        }

        @DeleteMapping("/{formId}/fields/{fieldId}")
        public ResponseEntity<?> deleteField(@PathVariable UUID formId,
                        @PathVariable UUID fieldId, @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                if (currentUser.getRole() == Role.USER) {
                        boolean isPublished = formService.isPublished(formId);
                        Permission requiredPerm = isPublished ? Permission.EDIT_PUBLISHED_FORM : Permission.EDIT_DRAFT_FORM;

                        if (!permissionService.hasPermission(currentUser, requiredPerm)) {
                                return ResponseEntity.status(403).body(Map.of("message", "You do not have permission to delete fields."));
                        }

                        if (permissionService.requiresApproval(currentUser, requiredPerm)) {
                                approvalService.createRequest(ApprovalRequest.ApprovalType.valueOf(requiredPerm.name()), formId.toString(), "Delete field request", currentUser);
                                return ResponseEntity.status(202).body(Map.of("message", "Field deletion requires admin approval. Request submitted."));
                        }
                }

                formService.getFormByIdAndUserId(formId, currentUser.getId());
                FormField sourceField = fieldRepository.findById(fieldId)
                                .orElseThrow(() -> new RuntimeException("Field not found"));
                String fieldKey = sourceField.getFieldKey();

                FormVersion targetVersion = formService.ensureEditableDraft(formId, currentUser);
                FormField field = fieldRepository.findByVersion_IdAndFieldKey(targetVersion.getId(), fieldKey)
                                .orElseThrow(() -> new RuntimeException("Field not found in draft"));

                fieldRepository.delete(field);
                return ResponseEntity.ok().build();
        }

        @PutMapping("/{formId}/fields/{fieldId}")
        public ResponseEntity<FormField> updateField(@PathVariable UUID formId,
                        @PathVariable UUID fieldId,
                        @Valid @RequestBody AddFieldRequest req, @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                Form form = formService.getFormByIdAndUserId(formId, currentUser.getId());
 
                FormField sourceField = fieldRepository.findById(fieldId)
                                .orElseThrow(() -> new RuntimeException("Field not found"));
                String fieldKey = sourceField.getFieldKey();

                FormVersion targetVersion = formService.ensureEditableDraft(formId, currentUser);
                FormField field = fieldRepository.findByVersion_IdAndFieldKey(targetVersion.getId(), fieldKey)
                                .orElseThrow(() -> new RuntimeException("Field not found in draft"));

                SqlTypeMapper.map(req.getFieldType());
                validateFieldConstraints(req);

                String safeKey = (req.getFieldKey() == null || req.getFieldKey().isBlank())
                                ? field.getFieldKey()
                                : InputSanitizer.sanitizeFieldKey(req.getFieldKey());

                if (!field.getFieldKey().equals(safeKey)) {
                        String baseKey = safeKey;
                        int counter = 1;
                        while (fieldRepository.existsByVersion_IdAndFieldKey(field.getVersion().getId(), safeKey)) {
                                safeKey = baseKey + "_" + counter++;
                        }
                        field.setFieldKey(safeKey);
                }
                try {
                        field.setFieldLabel(InputSanitizer.sanitizeText(req.getFieldLabel(), 300));
                } catch (RuntimeException e) {
                        throw new RuntimeException("Question label " + e.getMessage());
                }
                field.setFieldType(req.getFieldType().toUpperCase());
                field.setRequired(req.getRequired());
                field.setFieldOrder(req.getFieldOrder());
                try {
                        field.setHelpText(req.getHelpText() != null
                                        ? InputSanitizer.sanitizeText(req.getHelpText(), 500)
                                        : null);
                } catch (RuntimeException e) {
                        throw new RuntimeException("Help text " + e.getMessage());
                }

                // Touch form timestamp
                form.setUpdatedAt(java.time.LocalDateTime.now());
                formService.saveForm(form);

                if (req.getOptions() != null) {
                        try {
                                ObjectMapper mapper = new ObjectMapper();
                                Object cleanOpts = InputSanitizer.sanitizeOptions(req.getOptions());
                                field.setOptions(mapper.writeValueAsString(cleanOpts));
                        } catch (Exception e) {
                                throw new RuntimeException("Failed to serialize options");
                        }
                } else {
                        field.setOptions(null);
                }

                field.setMinValue(req.getMinValue());
                field.setMaxValue(req.getMaxValue());
                field.setMinLabel(req.getMinLabel());
                field.setMaxLabel(req.getMaxLabel());

                field.setMinValueStr(req.getMinValueStr() != null && !req.getMinValueStr().isBlank()
                                ? req.getMinValueStr().trim()
                                : null);
                field.setMaxValueStr(req.getMaxValueStr() != null && !req.getMaxValueStr().isBlank()
                                ? req.getMaxValueStr().trim()
                                : null);

                field.setCharType(req.getCharType() != null && !req.getCharType().isBlank()
                                ? req.getCharType().trim().toUpperCase()
                                : null);
                field.setMinLength(req.getMinLength());
                field.setMaxLength(req.getMaxLength());
                field.setTrimWhitespace(req.getTrimWhitespace() != null ? req.getTrimWhitespace() : true);
                field.setRemoveExtraSpaces(req.getRemoveExtraSpaces() != null ? req.getRemoveExtraSpaces() : true);
                field.setAllowSpecialChars(req.getAllowSpecialChars() != null ? req.getAllowSpecialChars() : true);
                field.setCustomRegex(req.getCustomRegex() != null && !req.getCustomRegex().isBlank()
                                ? req.getCustomRegex().trim()
                                : null);
                field.setAllowedFileTypes(req.getAllowedFileTypes() != null && !req.getAllowedFileTypes().isBlank()
                                ? req.getAllowedFileTypes().trim()
                                : null);
                field.setDataSourceTable(req.getDataSourceTable());
                field.setDataSourceColumn(req.getDataSourceColumn());
                field.setIsUnique(req.getIsUnique() != null ? req.getIsUnique() : false);

                return ResponseEntity.ok(fieldRepository.save(field));
        }

        @PutMapping("/{formId}/fields/reorder")
        public ResponseEntity<Void> reorderFields(@PathVariable UUID formId,
                        @RequestBody List<Map<String, Object>> orders, @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                Form form = formService.getFormByIdAndUserId(formId, currentUser.getId());
                FormVersion targetVersion = formService.ensureEditableDraft(formId, currentUser);

                for (Map<String, Object> item : orders) {
                        UUID fieldId = UUID.fromString(String.valueOf(item.get("fieldId")));
                        Integer newOrder = Integer.valueOf(String.valueOf(item.get("fieldOrder")));
                        
                        // Find by original ID to get key
                        fieldRepository.findById(fieldId).ifPresent(sf -> {
                            String key = sf.getFieldKey();
                            // Find corresponding field in target draft
                            fieldRepository.findByVersion_IdAndFieldKey(targetVersion.getId(), key).ifPresent(df -> {
                                df.setFieldOrder(newOrder);
                                fieldRepository.save(df);
                            });
                        });
                }
                // Touch form timestamp once
                form.setUpdatedAt(java.time.LocalDateTime.now());
                formService.saveForm(form);
                return ResponseEntity.ok().build();
        }

        @PostMapping("/{formId}/publish")
        public ResponseEntity<?> publishForm(@PathVariable UUID formId,
                        @RequestBody(required = false) Map<String, Object> body,
                        @AuthenticationPrincipal User currentUserPrincipal) {
                try {
                        User currentUser = userService.getUserById(currentUserPrincipal.getId());
                        
                        if (currentUser.getRole() == Role.USER) {
                                Permission requiredPerm = Permission.CREATE_DRAFT_FORM;
                                if (!permissionService.hasPermission(currentUser, requiredPerm)) {
                                        return ResponseEntity.status(403).body(Map.of("message", "You do not have permission to publish forms."));
                                }
                                
                                // Check if changes were made since last publish
                                Optional<FormVersion> pubVersion = formService.getPublishedVersion(formId);
                                Form form = formService.getFormByIdAndUserId(formId, currentUser.getId());
                                if (pubVersion.isPresent() && !form.getUpdatedAt().isAfter(pubVersion.get().getCreatedAt())) {
                                        // Double check if a pending request already exists
                                        Optional<ApprovalRequest> pending = approvalRequestRepository.findByReferenceIdAndStatus(formId.toString(), ApprovalRequest.ApprovalStatus.PENDING);
                                        if (pending.isEmpty()) {
                                                return ResponseEntity.badRequest().body(Map.of("message", "No changes detected since last publish."));
                                        }
                                }

                                // Unlike admins, Sub-users ALWAYS need to request approval to publish a form.
                                // The system manages this by updating the existing request if one is pending, 
                                // or creating a new one if it's the first request or a previous one was rejected.
                                String note = (body != null && body.containsKey("note")) ? (String) body.get("note") : "Publish request";
                                approvalService.createRequest(ApprovalRequest.ApprovalType.PUBLISH_FORM, formId.toString(), note, currentUser);
                                return ResponseEntity.status(202).body(Map.of("message", "Publication requires admin approval. Request submitted."));
                        }

                // Admins can publish any form they can find
                        formService.getFormById(formId);
                        FormVersion version = formService.getDraftVersion(formId)
                                        .or(() -> formService.getPublishedVersion(formId))
                                        .orElseThrow(() -> new RuntimeException("No version found to publish"));
                        schemaService.publishVersion(version.getId());
                        
                        return ResponseEntity.ok(Map.of("message", "Form published successfully", "versionId", version.getId().toString()));
                } catch (Exception e) {
                        e.printStackTrace();
                        return ResponseEntity.status(500).body(Map.of("message", "Failed to publish: " + e.getMessage()));
                }
        }

        // ─── Submissions ─────────────────────────────────────────────────────────

        @GetMapping("/{formId}/submissions")
        public ResponseEntity<?> getSubmissions(@PathVariable UUID formId,
                        @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                if (currentUser.getRole() == Role.USER) {
                        if (!permissionService.hasPermission(currentUser, Permission.VIEW_PUBLISHED_SUBMISSIONS)) {
                                return ResponseEntity.status(403).body(Map.of("message", "You do not have permission to view submissions."));
                        }
                }

                formService.getFormByIdAndUserId(formId, currentUser.getId());
                FormVersion version = formService.getPublishedVersion(formId)
                                .orElseThrow(() -> new RuntimeException("No published version found"));
                return ResponseEntity.ok(submissionService.getSubmissions(version.getId(), false, null));
        }

        @GetMapping("/{formId}/export")
        public ResponseEntity<byte[]> exportSubmissions(@PathVariable UUID formId,
                        @RequestParam(required = false) List<Long> ids,
                        @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                formService.getFormByIdAndUserId(formId, currentUser.getId());

                FormVersion version = formService.getPublishedVersion(formId)
                                .orElseThrow(() -> new RuntimeException("No published version found to export"));

                byte[] csvBytes = submissionService.exportToCsv(version.getId(), ids);

                String filename = "submissions_" + formId + ".csv";
                return ResponseEntity.ok()
                                .header("Content-Type", "text/csv")
                                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                                .body(csvBytes);
        }

        @PutMapping("/{formId}/submissions/{id}")
        public ResponseEntity<?> updateSubmission(
                        @PathVariable UUID formId,
                        @PathVariable Long id,
                        @RequestBody Map<String, Object> data, @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                if (currentUser.getRole() == Role.USER) {
                        return ResponseEntity.status(403).body(Map.of("message", "Only admins can edit submissions via this endpoint. Users edit via their specific responses page."));
                }

                formService.getFormByIdAndUserId(formId, currentUser.getId());
                FormVersion version = formService.getPublishedVersion(formId)
                                .orElseThrow(() -> new RuntimeException("No published version found"));
                submissionService.updateSubmission(version.getId(), id, data);
                return ResponseEntity.ok(Map.of("message", "Response updated successfully!"));
        }

        @DeleteMapping("/{formId}/submissions/{id}")
        public ResponseEntity<?> deleteSubmission(
                        @PathVariable UUID formId,
                        @PathVariable Long id, @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                if (currentUser.getRole() == Role.USER) {
                        return ResponseEntity.status(403).body(Map.of("message", "Sub-users do not have permission to delete submissions."));
                }

                formService.getFormByIdAndUserId(formId, currentUser.getId());
                FormVersion version = formService.getPublishedVersion(formId)
                                .orElseThrow(() -> new RuntimeException("No published version found"));
                submissionService.deleteSubmission(version.getId(), id);
                return ResponseEntity.ok(Map.of("message", "Response deleted successfully!"));
        }

        @DeleteMapping("/{formId}/submissions/bulk")
        public ResponseEntity<?> bulkDeleteSubmissions(
                        @PathVariable UUID formId,
                        @RequestBody List<Long> submissionIds, @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                if (currentUser.getRole() == Role.USER) {
                        return ResponseEntity.status(403).body(Map.of("message", "Sub-users do not have permission to delete submissions."));
                }

                formService.getFormByIdAndUserId(formId, currentUser.getId(), true);
                FormVersion version = formService.getPublishedVersion(formId)
                                .orElseThrow(() -> new RuntimeException("No published version found"));
                submissionService.bulkDeleteSubmissions(version.getId(), submissionIds, currentUser.getId());
                return ResponseEntity.ok(Map.of("message", "Responses deleted successfully!"));
        }

        @PostMapping("/{formId}/submissions/bulk/recover")
        public ResponseEntity<Map<String, String>> bulkRecoverSubmissions(
                        @PathVariable UUID formId,
                        @RequestBody List<Long> submissionIds, @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                formService.getFormByIdAndUserId(formId, currentUser.getId(), true);
                FormVersion version = formService.getPublishedVersion(formId)
                                .orElseThrow(() -> new RuntimeException("No published version found"));
                submissionService.bulkRecoverSubmissions(version.getId(), submissionIds, currentUser.getId());
                return ResponseEntity.ok(Map.of("message", "Responses recovered successfully!"));
        }

        @GetMapping("/{formId}/submissions/count")
        public ResponseEntity<Map<String, Integer>> getSubmissionCount(@PathVariable UUID formId,
                        @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                formService.getFormByIdAndUserId(formId, currentUser.getId());
                FormVersion version = formService.getPublishedVersion(formId).orElse(null);
                if (version == null)
                        return ResponseEntity.ok(Map.of("count", 0));
                return ResponseEntity.ok(Map.of("count", submissionService.getSubmissionCount(version.getId())));
        }

        @GetMapping("/{formId}/fields/{fieldKey}/options")
        public ResponseEntity<List<?>> getFieldOptions(@PathVariable UUID formId, @PathVariable String fieldKey,
                        @AuthenticationPrincipal User currentUserPrincipal) {
                User currentUser = userService.getUserById(currentUserPrincipal.getId());
                formService.getFormByIdAndUserId(formId, currentUser.getId());
                FormVersion version = formService.getDraftVersion(formId)
                                .or(() -> formService.getPublishedVersion(formId))
                                .orElseThrow(() -> new RuntimeException("No version found for form " + formId));
                FormField field = fieldRepository.findByVersion_IdAndFieldKey(version.getId(), fieldKey)
                                .orElseThrow(() -> new RuntimeException("Field not found"));

                if (field.getDataSourceTable() != null && field.getDataSourceColumn() != null) {
                        String table = field.getDataSourceTable();
                        String column = field.getDataSourceColumn();
                        if (!table.matches("^[a-zA-Z0-9_]+$") || !column.matches("^[a-zA-Z0-9_]+$")) {
                                throw new RuntimeException("Invalid table or column name");
                        }
                        // Return both ID and the column value for "Call by Reference"
                        String sql = "SELECT \"id\", \"" + column + "\" as label FROM \"" + table + "\" WHERE \""
                                        + column + "\" IS NOT NULL ORDER BY \"" + column + "\"";
                        return ResponseEntity.ok(jdbcTemplate.queryForList(sql));
                }

                if (field.getOptions() != null) {
                        try {
                                ObjectMapper mapper = new ObjectMapper();
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

        private void validateFieldConstraints(AddFieldRequest req) {
                if (req.getMinLength() != null && req.getMaxLength() != null
                                && req.getMinLength() > req.getMaxLength()) {
                        throw new IllegalArgumentException("Minimum length cannot be greater than maximum length");
                }
                if (req.getMinValueStr() != null && !req.getMinValueStr().isBlank() &&
                                req.getMaxValueStr() != null && !req.getMaxValueStr().isBlank()) {
                        try {
                                java.math.BigDecimal min = new java.math.BigDecimal(req.getMinValueStr().trim());
                                java.math.BigDecimal max = new java.math.BigDecimal(req.getMaxValueStr().trim());
                                if (min.compareTo(max) > 0) {
                                        throw new IllegalArgumentException(
                                                        "Minimum value cannot be greater than maximum value");
                                }
                        } catch (Exception e) {
                                if (req.getMinValueStr().trim().compareTo(req.getMaxValueStr().trim()) > 0) {
                                        throw new IllegalArgumentException(
                                                        "Minimum value cannot be greater than maximum value");
                                }
                        }
                }
        }

        /**
         * Get soft-deleted submissions for a form.
         */
        @GetMapping("/{formId}/submissions/trash")
        public ResponseEntity<?> getTrashSubmissions(@PathVariable UUID formId) {
                try {
                        Form form = formService.getFormById(formId);
                        java.util.Optional<FormVersion> version = formService.getPublishedVersion(form.getId());
                        if (version.isEmpty()) {
                                return ResponseEntity.ok(java.util.Collections.emptyList());
                        }
                        return ResponseEntity.ok(submissionService.getTrashSubmissions(version.get().getId()));
                } catch (Exception e) {
                        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
                }
        }

        /**
         * Recover a soft-deleted submission.
         */
        @PostMapping("/{formId}/submissions/{submissionId}/recover")
        public ResponseEntity<?> recoverSubmission(@PathVariable UUID formId, @PathVariable Long submissionId) {
                try {
                        Form form = formService.getFormById(formId);
                        java.util.Optional<FormVersion> version = formService.getPublishedVersion(form.getId());
                        if (version.isEmpty()) {
                                return ResponseEntity.badRequest().body(Map.of("message", "Form version not found"));
                        }
                        submissionService.recoverSubmission(version.get().getId(), submissionId);
                        return ResponseEntity.ok(Map.of("message", "Submission recovered successfully"));
                } catch (Exception e) {
                        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
                }
        }
}