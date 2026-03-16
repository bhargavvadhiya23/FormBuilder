package com.sttl.formbuilder.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sttl.formbuilder.Enums.Permission;
import com.sttl.formbuilder.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Evaluates whether a User has a given fine-grained Permission.
 * ADMIN users implicitly have every permission.
 */
@Service
@RequiredArgsConstructor
public class PermissionService {

    private final ObjectMapper objectMapper;

    /**
     * Returns true if the user holds the specified permission.
     * Admin users always return true.
     */
    public boolean hasPermission(User user, Permission permission) {
        if (user == null) return false;

        // Admins have every permission implicitly
        if (user.getRole() == com.sttl.formbuilder.Enums.Role.ADMIN) return true;

        // Sub-user must have an AppRole with the permission
        if (user.getAppRole() == null) return false;
        return user.getAppRole().getPermissions().contains(permission);
    }

    /**
     * Throws 403 if the user does not hold the specified permission.
     */
    public void checkPermission(User user, Permission permission) {
        if (!hasPermission(user, permission)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not have permission to perform this action: " + permission.name());
        }
    }

    /**
     * Returns true if the user's role requires admin approval for this specific permission.
     * Always returns false for admins (they act directly).
     */
    public boolean requiresApproval(User user, Permission permission) {
        if (user == null || user.getAppRole() == null) return false;
        if (user.getRole() == com.sttl.formbuilder.Enums.Role.ADMIN) return false;
        if (user.getCreatedByAdmin() == null) return false; // No admin to route to, so cannot require approval

        String json = user.getAppRole().getApprovalRequiredMap();
        if (json == null || json.isBlank() || json.equals("{}")) return false;

        try {
            Map<String, Boolean> map = objectMapper.readValue(json, new TypeReference<>() {});
            return Boolean.TRUE.equals(map.get(permission.name()));
        } catch (Exception e) {
            return false;
        }
    }
}
