package com.sttl.formbuilder.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sttl.formbuilder.entity.FormField;

public interface FormFieldRepository extends JpaRepository<FormField, UUID> {

        List<FormField> findByVersion_IdOrderByFieldOrder(UUID versionId);

        boolean existsByVersion_IdAndFieldKey(UUID versionId, String fieldKey);

        java.util.Optional<FormField> findByVersion_IdAndFieldKey(UUID versionId, String fieldKey);
}
