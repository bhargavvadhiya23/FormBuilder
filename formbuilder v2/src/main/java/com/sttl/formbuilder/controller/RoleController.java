package com.sttl.formbuilder.controller;

import com.sttl.formbuilder.service.RoleManagementService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sttl.formbuilder.Enums.Permission;
import com.sttl.formbuilder.entity.AppRole;
import com.sttl.formbuilder.entity.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * CRUD for dynamic AppRoles.
 * Only accessible to ADMIN users (enforced in SecurityConfig).
 */
@RestController
@RequestMapping("${api.base-path}/admin/roles")
public class RoleController {

    private final RoleManagementService roleManagementService;
    private final ObjectMapper objectMapper;
    private final com.sttl.formbuilder.service.UserService userService;

    public RoleController(RoleManagementService roleManagementService,
                          ObjectMapper objectMapper,
                          com.sttl.formbuilder.service.UserService userService) {
        this.roleManagementService = roleManagementService;
        this.objectMapper = objectMapper;
        this.userService = userService;
    }

    /** List all roles visible to the current admin (system + their custom roles). */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getRoles(@AuthenticationPrincipal User adminUserPrincipal) {
        User adminUser = userService.getUserById(adminUserPrincipal.getId());
        List<AppRole> roles = roleManagementService.getRolesForAdmin(adminUser.getId());
        return ResponseEntity.ok(roles.stream().map(this::toMap).toList());
    }

    /** Create a new custom role. */
    @PostMapping
    public ResponseEntity<?> createRole(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User adminUserPrincipal) {
        User adminUser = userService.getUserById(adminUserPrincipal.getId());
        try {
            String name = (String) body.get("name");
            Set<Permission> permissions = parsePermissions(body);
            String approvalMap = buildApprovalMap(body);
            List<UUID> moduleIds = parseModuleIds(body);

            AppRole created = roleManagementService.createRole(name, permissions, approvalMap, adminUser);
            // After creating role, assign modules (will need service support)
            roleManagementService.updateRoleModules(created.getId(), moduleIds, adminUser);
            
            return ResponseEntity.ok(toMap(created));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /** Update a custom role. */
    @PutMapping("/{roleId}")
    public ResponseEntity<?> updateRole(
            @PathVariable UUID roleId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User adminUserPrincipal) {
        User adminUser = userService.getUserById(adminUserPrincipal.getId());
        try {
            String name = (String) body.get("name");
            Set<Permission> permissions = parsePermissions(body);
            String approvalMap = buildApprovalMap(body);
            List<UUID> moduleIds = parseModuleIds(body);

            AppRole updated = roleManagementService.updateRole(roleId, name, permissions, approvalMap, adminUser);
            roleManagementService.updateRoleModules(roleId, moduleIds, adminUser);
            
            return ResponseEntity.ok(toMap(updated));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /** Delete a custom role. */
    @DeleteMapping("/{roleId}")
    public ResponseEntity<?> deleteRole(
            @PathVariable UUID roleId,
            @AuthenticationPrincipal User adminUserPrincipal) {
        User adminUser = userService.getUserById(adminUserPrincipal.getId());
        try {
            roleManagementService.deleteRole(roleId, adminUser);
            return ResponseEntity.ok(Map.of("message", "Role deleted"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // ---- helpers ----

    private Map<String, Object> toMap(AppRole role) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", role.getId());
        m.put("name", role.getName());
        m.put("isSystem", role.isSystem());
        m.put("permissions", role.getPermissions().stream().map(Permission::name).sorted().toList());
        m.put("modules", role.getModules().stream().map(com.sttl.formbuilder.entity.Module::getId).toList());
        m.put("approvalRequiredMap", parseApprovalMap(role.getApprovalRequiredMap()));
        m.put("createdAt", role.getCreatedAt());
        return m;
    }

    private List<UUID> parseModuleIds(Map<String, Object> body) {
        Object raw = body.get("modules");
        if (!(raw instanceof List<?> list)) return List.of();
        List<UUID> ids = new ArrayList<>();
        for (Object item : list) {
            try { ids.add(UUID.fromString(String.valueOf(item))); } catch (Exception ignored) {}
        }
        return ids;
    }

    private Set<Permission> parsePermissions(Map<String, Object> body) {
        Object raw = body.get("permissions");
        if (!(raw instanceof List<?> list)) return EnumSet.noneOf(Permission.class);
        Set<Permission> perms = new HashSet<>();
        for (Object item : list) {
            try { perms.add(Permission.valueOf(String.valueOf(item))); } catch (Exception ignored) {}
        }
        return perms;
    }

    private String buildApprovalMap(Map<String, Object> body) {
        try {
            Object raw = body.get("approvalRequiredMap");
            if (raw == null) return "{}";
            return objectMapper.writeValueAsString(raw);
        } catch (Exception e) {
            return "{}";
        }
    }

    private Map<String, Boolean> parseApprovalMap(String json) {
        try {
            if (json == null || json.isBlank()) return Map.of();
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}
