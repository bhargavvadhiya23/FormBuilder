package com.sttl.formbuilder.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sttl.formbuilder.entity.FormField;

public interface FormFieldRepository extends JpaRepository<FormField, UUID> {

        List<FormField> findByVersion_IdOrderByFieldOrder(UUID versionId);

        boolean existsByVersion_IdAndFieldKey(UUID versionId, String fieldKey);

        java.util.Optional<FormField> findByVersion_IdAndFieldKey(UUID versionId, String fieldKey);

        long countByVersion_Id(UUID versionId);

        long countByVersion_IdAndFieldType(UUID versionId, String fieldType);

        @Query("select distinct f.fieldKey from FormField f where f.version.form.id = :formId and upper(f.fieldType) not in ('HEADING', 'PAGE_BREAK')")
        List<String> findDistinctSchemaFieldKeysByFormId(@Param("formId") UUID formId);
}
