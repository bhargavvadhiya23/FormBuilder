package com.sttl.formbuilder.service;

import com.sttl.formbuilder.Enums.Permission;
import com.sttl.formbuilder.entity.AppRole;
import com.sttl.formbuilder.repository.AppRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;

import java.util.EnumSet;

/**
 * Seeds the two mandatory system roles on application startup:
 *   • Admin — all permissions, cannot be deleted/edited
 *   • User  — fill form + edit own response only, cannot be deleted/edited
 */
@Component
@RequiredArgsConstructor
public class DataSeeder {

    private final AppRoleRepository appRoleRepository;

    @PostConstruct
    public void seedSystemRoles() {
        seedAdminRole();
    }

    private void seedAdminRole() {
        if (appRoleRepository.existsByName("Admin")) return;

        AppRole admin = new AppRole();
        admin.setName("Admin");
        admin.setSystem(true);
        admin.setCreatedByAdmin(null);
        admin.setPermissions(EnumSet.allOf(Permission.class));
        admin.setApprovalRequiredMap("{}");
        appRoleRepository.save(admin);
    }
}
