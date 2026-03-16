package com.sttl.formbuilder.repository;

import com.sttl.formbuilder.entity.FormRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FormRuleRepository extends JpaRepository<FormRule, UUID> {

    /** Get all enabled rules for a form, ordered by priority */
    List<FormRule> findByFormIdAndEnabledTrueOrderByPriorityAsc(UUID formId);

    /** Get all rules (enabled or not) for a form */
    List<FormRule> findByFormIdOrderByPriorityAsc(UUID formId);

    /** Delete all rules belonging to a form */
    void deleteByFormId(UUID formId);
}
