package com.sttl.formbuilder.service;

import com.sttl.formbuilder.entity.AppRole;
import com.sttl.formbuilder.entity.User;
import com.sttl.formbuilder.Enums.Permission;
import com.sttl.formbuilder.repository.AppRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * CRUD operations for dynamic AppRoles.
 * System roles ("Admin" and "User") are protected from modification.
 */
@Service
@RequiredArgsConstructor
public class RoleManagementService {

    private final AppRoleRepository appRoleRepository;
    private final com.sttl.formbuilder.repository.ModuleRepository moduleRepository;

    /**
     * Returns all roles visible to this admin: system roles + their own custom roles.
     */
    public List<AppRole> getRolesForAdmin(UUID adminId) {
        // Collect system roles
        List<AppRole> systemRoles = appRoleRepository.findAll()
                .stream()
                .filter(AppRole::isSystem)
                .toList();

        // Collect custom roles created by this admin
        List<AppRole> customRoles = appRoleRepository.findByCreatedByAdmin_Id(adminId);

        List<AppRole> combined = new java.util.ArrayList<>(systemRoles);
        combined.addAll(customRoles);
        return combined;
    }

    /**
     * Creates a new custom role for the given admin.
     */
    public AppRole createRole(String name, Set<Permission> permissions, String approvalRequiredMap, User adminUser) {
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role name cannot be blank");
        }
        if (appRoleRepository.existsByName(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A role with that name already exists");
        }

        AppRole role = new AppRole();
        role.setName(name.trim());
        role.setSystem(false);
        role.setCreatedByAdmin(adminUser);
        role.setPermissions(permissions != null ? permissions : EnumSet.noneOf(Permission.class));
        role.setApprovalRequiredMap(approvalRequiredMap != null ? approvalRequiredMap : "{}");
        return appRoleRepository.save(role);
    }

    /**
     * Updates a custom role's name, permissions, and approval flags.
     * Throws 403 if the role is a system role.
     */
    public AppRole updateRole(UUID roleId, String name, Set<Permission> permissions, String approvalRequiredMap, User adminUser) {
        AppRole role = getRole(roleId);
        // Allow editing system roles as well now

        // Ensure the admin owns this role (or it's a system role like Admin which has no owner)
        if (!role.isSystem() && role.getCreatedByAdmin() != null && !role.getCreatedByAdmin().getId().equals(adminUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this role");
        }

        if (name != null && !name.isBlank()) {
            // Check name uniqueness (excluding itself)
            appRoleRepository.findByName(name.trim()).ifPresent(existing -> {
                if (!existing.getId().equals(roleId)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "A role with that name already exists");
                }
            });
            role.setName(name.trim());
        }
        if (permissions != null) role.setPermissions(permissions);
        if (approvalRequiredMap != null) role.setApprovalRequiredMap(approvalRequiredMap);

        return appRoleRepository.save(role);
    }

    /**
     * Deletes a custom role.
     * Throws 403 if the role is a system role.
     */
    public void deleteRole(UUID roleId, User adminUser) {
        AppRole role = getRole(roleId);
        if (role.isSystem()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "System roles cannot be deleted");
        }
        if (role.getCreatedByAdmin() == null || !role.getCreatedByAdmin().getId().equals(adminUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this role");
        }
        appRoleRepository.delete(role);
    }

    public AppRole getRole(UUID roleId) {
        return appRoleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found: " + roleId));
    }

    /**
     * Updates the dynamic modules assigned to a role.
     */
    public void updateRoleModules(UUID roleId, List<UUID> moduleIds, User adminUser) {
        AppRole role = getRole(roleId);
        // Allow editing system roles module assignments
        if (!role.isSystem() && role.getCreatedByAdmin() != null && !role.getCreatedByAdmin().getId().equals(adminUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this role");
        }

        List<com.sttl.formbuilder.entity.Module> modules = moduleRepository.findAllById(moduleIds);
        role.setModules(new java.util.HashSet<>(modules));
        appRoleRepository.save(role);
    }
}
