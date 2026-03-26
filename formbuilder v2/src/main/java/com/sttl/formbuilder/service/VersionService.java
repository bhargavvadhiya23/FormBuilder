package com.sttl.formbuilder.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

import com.sttl.formbuilder.entity.Form;
import com.sttl.formbuilder.entity.FormVersion;
import com.sttl.formbuilder.repository.FormRepository;
import com.sttl.formbuilder.repository.FormVersionRepository;

import lombok.RequiredArgsConstructor;

@Service
public class VersionService {

    private final FormRepository formRepository;
    private final FormVersionRepository versionRepository;

    public VersionService(FormRepository formRepository,
            FormVersionRepository versionRepository) {
        this.formRepository = formRepository;
        this.versionRepository = versionRepository;
    }

    public FormVersion createDraftVersion(UUID formId) {

        Form form = formRepository.findById(formId)
                .orElseThrow(() -> new RuntimeException("Form not found"));

        int nextVersion = versionRepository.countByFormId(formId) + 1;

        FormVersion version = new FormVersion();
        version.setForm(form);
        version.setVersionNumber(nextVersion);
        version.setStatus("DRAFT");

        return versionRepository.save(version);
    }

    public List<FormVersion> getVersionsDataByFormId(UUID formId) {
        return versionRepository.findByFormIdAndDeletedFalseOrderByVersionNumberDesc(formId);
    }

    public FormVersion activateVersion(UUID versionId) {
        FormVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        if (!"PUBLISHED".equals(version.getStatus()) && !"ARCHIVED".equals(version.getStatus())) {
            throw new RuntimeException("Only published or archived versions can be activated");
        }

        // Deactivate all other versions of the same form

        List<FormVersion> allVersions = versionRepository.findByFormId(version.getForm().getId());
        for (FormVersion v : allVersions) {
            if (v.isActive() || "PUBLISHED".equals(v.getStatus())) {
                v.setActive(false);
                v.setStatus("ARCHIVED"); // Demote old live versions
                versionRepository.save(v);
            }
        }

        version.setActive(true);
        version.setStatus("PUBLISHED"); // Promote newly activated version
        return versionRepository.save(version);
    }
}