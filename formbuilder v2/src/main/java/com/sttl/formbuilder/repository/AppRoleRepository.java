package com.sttl.formbuilder.repository;

import com.sttl.formbuilder.entity.AppRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AppRoleRepository extends JpaRepository<AppRole, UUID> {

    Optional<AppRole> findByName(String name);

    /** All custom roles created by a specific admin (excludes system roles if needed). */
    List<AppRole> findByCreatedByAdmin_Id(UUID adminId);

    /** Check whether a role name is already taken. */
    boolean existsByName(String name);
}
