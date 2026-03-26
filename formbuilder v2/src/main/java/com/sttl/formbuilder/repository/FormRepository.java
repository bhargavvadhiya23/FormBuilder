package com.sttl.formbuilder.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sttl.formbuilder.entity.Form;

public interface FormRepository extends JpaRepository<Form, UUID> {
    boolean existsByName(String name);

    @Query("SELECT f FROM Form f WHERE f.createdBy.id = :userId AND f.deleted = :deleted")
    List<Form> findByCreatedBy_IdAndDeleted(@Param("userId") UUID userId, @Param("deleted") boolean deleted);

    @Query("SELECT f FROM Form f WHERE " +
            "((f.createdBy.id = :userId) OR " +
            "(f.createdBy.createdByAdmin.id = :userId AND EXISTS (SELECT v FROM FormVersion v WHERE v.form = f AND v.status = 'PUBLISHED'))) "
            +
            "AND f.deleted = :deleted")
    List<Form> findAllVisibleToUser(@Param("userId") UUID userId, @Param("deleted") boolean deleted);

    boolean existsByNameAndCreatedByAndDeletedFalse(String name, com.sttl.formbuilder.entity.User createdBy);

    boolean existsByNameAndCreatedByAndDeletedFalseAndIdNot(String name, com.sttl.formbuilder.entity.User createdBy, UUID id);
}