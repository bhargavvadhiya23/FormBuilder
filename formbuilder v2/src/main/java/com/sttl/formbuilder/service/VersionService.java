package com.sttl.formbuilder.service;

import org.springframework.stereotype.Service;

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
}