package com.sttl.formbuilder.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.annotation.PostConstruct;

import com.sttl.formbuilder.entity.Form;
import com.sttl.formbuilder.entity.FormVersion;
import com.sttl.formbuilder.entity.FormField;
import com.sttl.formbuilder.entity.User;
import com.sttl.formbuilder.repository.FormRepository;
import com.sttl.formbuilder.repository.FormVersionRepository;
import com.sttl.formbuilder.repository.FormFieldRepository;

import com.sttl.formbuilder.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;

@Service
@Transactional
public class FormService {

    private final FormRepository formRepository;
    private final FormVersionRepository versionRepository;
    private final FormFieldRepository fieldRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final SchemaService schemaService;

    public FormService(FormRepository formRepository,
            FormVersionRepository versionRepository,
            FormFieldRepository fieldRepository,
            UserRepository userRepository,
            JdbcTemplate jdbcTemplate,
            SchemaService schemaService) {
        this.formRepository = formRepository;
        this.versionRepository = versionRepository;
        this.fieldRepository = fieldRepository;
        this.userRepository = userRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.schemaService = schemaService;
    }

    @PostConstruct
    public void init() {
        try {
            jdbcTemplate.execute("ALTER TABLE forms DROP CONSTRAINT IF EXISTS forms_name_key;");
            // Backfill: ensure all existing forms have deleted=false if null
            jdbcTemplate.execute("UPDATE forms SET deleted = false WHERE deleted IS NULL");
            // Backfill: ensure all existing users have soft_delete_enabled=true
            jdbcTemplate.execute(
                    "UPDATE users SET soft_delete_enabled = true WHERE soft_delete_enabled IS NULL OR soft_delete_enabled = false");
        } catch (Exception e) {
            System.err.println("Note: forms_name_key already dropped or backfill already done.");
        }

    }

    public List<Form> getAllForms() {
        return formRepository.findAll();
    }

    public List<Form> getFormsByUserId(UUID userId) {
        System.out.println("DEBUG: Fetching active forms (deleted=false) for user: " + userId);
        return formRepository.findAllVisibleToUser(userId, false);
    }

    public List<Form> getTrashForms(UUID userId) {
        System.out.println("DEBUG: Fetching trash forms (deleted=true) for user: " + userId);
        return formRepository.findAllVisibleToUser(userId, true);
    }

    public Form getFormById(UUID id) {
        return getFormById(id, false);
    }

    public Form getFormById(UUID id, boolean allowDeleted) {
        Form form = formRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Form not found with id: " + id));
        if (!allowDeleted && form.isDeleted()) {
            throw new RuntimeException("This form has been deleted.");
        }
        return form;
    }

    public Optional<Form> findFormById(UUID id) {
        return formRepository.findById(id);
    }

    public Form getFormByIdAndUserId(UUID id, UUID userId) {
        return getFormByIdAndUserId(id, userId, false);
    }

    public Form getFormByIdAndUserId(UUID id, UUID userId, boolean allowDeleted) {
        Form form = getFormById(id, allowDeleted);

        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        boolean isAdmin = user.getRole() == com.sttl.formbuilder.Enums.Role.ADMIN;
        boolean isOwner = form.getCreatedBy() != null && form.getCreatedBy().getId().equals(userId);
        boolean isAdminManager = form.getCreatedBy() != null &&
                form.getCreatedBy().getCreatedByAdmin() != null &&
                form.getCreatedBy().getCreatedByAdmin().getId().equals(userId);

        if (!isAdmin && !isOwner && !isAdminManager) {
            throw new RuntimeException("You do not have permission to access this form");
        }
        return form;
    }

    /**
     * Create a new form AND automatically create its first draft version.
     * This hides the version concept from the UI (Google Forms style).
     */
    @Transactional
    public Form createFormWithVersion(String name, String description, User currentUser) {
        // Sanitize inputs
        String cleanName = com.sttl.formbuilder.util.InputSanitizer.sanitizeText(name, 150);

        if (cleanName == null || cleanName.isBlank()) {
            throw new RuntimeException("Form name must not be blank");
        }

        // Uniqueness check per user (active forms only)
        if (formRepository.existsByNameAndCreatedByAndDeletedFalse(cleanName, currentUser)) {
            throw new RuntimeException("A form with this name already exists. Please choose a different name.");
        }

        String cleanDesc = description != null ? com.sttl.formbuilder.util.InputSanitizer.sanitizeText(description, 500)
                : null;

        // Create form
        Form form = new Form();
        form.setName(cleanName);
        form.setDescription(cleanDesc);
        form.setCreatedBy(currentUser);
        form.setDeleted(false); // Explicitly active on creation
        Form saved = formRepository.save(form);

        // Auto-create version 1 (hidden from UI)
        FormVersion version = new FormVersion();
        version.setForm(saved);
        version.setVersionNumber(1);
        version.setStatus("DRAFT");
        version.setCreatedBy(currentUser);
        versionRepository.save(version);

        return saved;
    }

    public Form createForm(String name, String description, User currentUser) {
        return createFormWithVersion(name, description, currentUser);
    }

    /**
     * Save an existing form entity directly (used to update createdBy etc).
     */
    public Form saveForm(Form form) {
        return formRepository.save(form);
    }

    /**
     * Get the draft version for a form (the one currently being edited).
     */
    public Optional<FormVersion> getDraftVersion(UUID formId) {
        return versionRepository.findTopByFormIdAndStatus(formId, "DRAFT");
    }

    /**
     * Get the latest published version for a form (for the public fill page).
     */
    public Optional<FormVersion> getPublishedVersion(UUID formId) {
        // Favor the explicitly active version first
        Optional<FormVersion> active = versionRepository.findByFormIdAndIsActiveTrue(formId);
        if (active.isPresent()) {
            return active;
        }
        // Fallback to latest published for compatibility
        return versionRepository.findTopByFormIdAndStatus(formId, "PUBLISHED");
    }

    /**
     * Check if a form has a published version (i.e. shareable link is active).
     */
    public boolean isPublished(UUID formId) {
        return versionRepository.findByFormIdAndIsActiveTrue(formId).isPresent() 
            || versionRepository.findTopByFormIdAndStatus(formId, "PUBLISHED").isPresent();
    }

    @Transactional
    public Form recoverForm(UUID formId, UUID userId) {
        // Use true for allowDeleted since we are in the process of recovering it
        Form form = getFormByIdAndUserId(formId, userId, true);
        form.setDeleted(false);
        return formRepository.save(form);
    }

    /**
     * Bulk recover multiple forms.
     */
    @Transactional
    public void bulkRecoverForms(List<UUID> formIds, UUID userId) {
        for (UUID formId : formIds) {
            recoverForm(formId, userId);
        }
    }

    /**
     * Update form title and description.
     */
    @Transactional
    public Form updateForm(UUID formId, String name, String description, Boolean oneSubmissionPerUser,
            java.time.LocalDateTime unpublishTime) {
        Form form = getFormById(formId);
        if (name != null && !name.isBlank()) {
            String cleanName = com.sttl.formbuilder.util.InputSanitizer.sanitizeText(name, 150);

            // Uniqueness check per user (active forms only, exclude current form)
            if (formRepository.existsByNameAndCreatedByAndDeletedFalseAndIdNot(cleanName, form.getCreatedBy(), formId)) {
                throw new RuntimeException("A form with this name already exists. Please choose a different name.");
            }

            form.setName(cleanName);
        }
        if (description != null) {
            form.setDescription(com.sttl.formbuilder.util.InputSanitizer.sanitizeText(description, 500));
        }
        form.setOneSubmissionPerUser(oneSubmissionPerUser);
        form.setUnpublishTime(unpublishTime);
        return formRepository.save(form);
    }

    /**
     * Delete form, all its versions, fields and drop associated submission tables.
     */
    @Transactional
    public void deleteForm(UUID formId) {
        Form form = getFormById(formId, true);
        User creator = form.getCreatedBy();

        // Re-fetch user from DB to ensure we have the latest softDeleteEnabled setting
        boolean softDeleteEnabled = false;
        if (creator != null) {
            User user = userRepository.findById(creator.getId()).orElse(creator);
            softDeleteEnabled = Boolean.TRUE.equals(user.getSoftDeleteEnabled());
        }

        // If soft delete is enabled and the form is not already deleted, soft delete it
        if (softDeleteEnabled && !form.isDeleted()) {
            form.setDeleted(true);
            formRepository.save(form);
            
            // Cascading soft-delete to versions
            List<FormVersion> versions = versionRepository.findByFormId(formId);
            for (FormVersion v : versions) {
                v.setDeleted(true);
                versionRepository.save(v);
            }
            return;
        }

        // Otherwise, perform permanent hard delete
        // 1. Drop submission tables for all versions
        List<FormVersion> versions = versionRepository.findByFormId(formId);
        for (FormVersion v : versions) {
            String tableName = v.getTableName();
            if (tableName != null && !tableName.isBlank()) {
                jdbcTemplate.execute("DROP TABLE IF EXISTS \"" + tableName + "\"");
            }

            // 2. Delete fields for this version (to avoid FK constraint with version)
            List<FormField> fields = fieldRepository.findByVersion_IdOrderByFieldOrder(v.getId());
            fieldRepository.deleteAll(fields);
        }

        // 3. Delete the version records components explicitly
        versionRepository.deleteAll(versions);

        // 4. Delete the form itself
        formRepository.delete(form);
    }

    /**
     * Bulk delete multiple forms.
     */
    @Transactional
    public void bulkDeleteForms(List<UUID> formIds, UUID userId) {
        for (UUID formId : formIds) {
            // Verify ownership first
            getFormByIdAndUserId(formId, userId, true);
            deleteForm(formId);
        }
    }

    /**
     * Admin executes a deferred deletion of a published form.
     */
    @Transactional
    public void deleteFormByAdmin(UUID formId) {
        deleteForm(formId);
    }

    /**
     * Admin executes a deferred publish of a draft form.
     */
    @Transactional
    public void publishFormByAdmin(UUID formId, User admin) {
        FormVersion version = getDraftVersion(formId)
                .or(() -> getPublishedVersion(formId))
                .orElseThrow(() -> new RuntimeException("No version found to publish"));

        // Call SchemaService to create/sync the database table
        schemaService.publishVersion(version.getId());
    }

    /**
     * Ensures an editable DRAFT exists for the form.
     * If no DRAFT exists but a PUBLISHED exists, clones it into a new DRAFT.
     */
    @Transactional
    public FormVersion ensureEditableDraft(UUID formId, User user) {
        Optional<FormVersion> draft = getDraftVersion(formId);
        if (draft.isPresent()) {
            return draft.get();
        }

        Optional<FormVersion> published = getPublishedVersion(formId);
        if (published.isPresent()) {
            return cloneAndCreateDraft(published.get(), user);
        }

        // Neither exists? (Shouldn't happen with our create flow, but for safety:)
        FormVersion newDraft = new FormVersion();
        newDraft.setForm(getFormById(formId));
        newDraft.setVersionNumber(versionRepository.countByFormId(formId) + 1);
        newDraft.setStatus("DRAFT");
        newDraft.setCreatedBy(user);
        return versionRepository.save(newDraft);
    }

    private FormVersion cloneAndCreateDraft(FormVersion source, User creator) {
        FormVersion newDraft = new FormVersion();
        newDraft.setForm(source.getForm());
        newDraft.setVersionNumber(versionRepository.countByFormId(source.getForm().getId()) + 1);
        newDraft.setStatus("DRAFT");
        newDraft.setCreatedBy(creator);
        // We don't copy tableName to the draft yet, schemaService assigns it on publish
        FormVersion savedDraft = versionRepository.save(newDraft);

        // Clone all fields
        List<FormField> sourceFields = fieldRepository.findByVersion_IdOrderByFieldOrder(source.getId());
        for (FormField sf : sourceFields) {
            FormField df = new FormField();
            df.setVersion(savedDraft);
            df.setFieldKey(sf.getFieldKey());
            df.setFieldLabel(sf.getFieldLabel());
            df.setFieldType(sf.getFieldType());
            df.setRequired(sf.getRequired());
            df.setFieldOrder(sf.getFieldOrder());
            df.setHelpText(sf.getHelpText());
            df.setOptions(sf.getOptions());
            df.setMinValue(sf.getMinValue());
            df.setMaxValue(sf.getMaxValue());
            df.setMinLabel(sf.getMinLabel());
            df.setMaxLabel(sf.getMaxLabel());
            df.setMinValueStr(sf.getMinValueStr());
            df.setMaxValueStr(sf.getMaxValueStr());
            df.setCharType(sf.getCharType());
            df.setMinLength(sf.getMinLength());
            df.setMaxLength(sf.getMaxLength());
            df.setTrimWhitespace(sf.getTrimWhitespace());
            df.setRemoveExtraSpaces(sf.getRemoveExtraSpaces());
            df.setAllowSpecialChars(sf.getAllowSpecialChars());
            df.setCustomRegex(sf.getCustomRegex());
            df.setAllowedFileTypes(sf.getAllowedFileTypes());
            df.setDataSourceTable(sf.getDataSourceTable());
            df.setDataSourceColumn(sf.getDataSourceColumn());
            df.setIsUnique(sf.getIsUnique());
            df.setDefaultValue(sf.getDefaultValue());
            df.setCustomPlaceholder(sf.getCustomPlaceholder());
            df.setIsOriginal(true); // Mark as original cloned field
            fieldRepository.save(df);
        }
        return savedDraft;
    }
}