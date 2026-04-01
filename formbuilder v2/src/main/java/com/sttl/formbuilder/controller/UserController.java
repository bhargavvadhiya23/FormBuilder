package com.sttl.formbuilder.controller;

import com.sttl.formbuilder.entity.User;
import com.sttl.formbuilder.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

@RestController
@RequiredArgsConstructor
@org.springframework.transaction.annotation.Transactional
public class UserController {

    // Removed class-level RequestMapping to allow multiple prefixes

    private final UserService userService;
    private final AuthenticationManager authenticationManager;

    /**
     * POST /admin/api/auth/register OR /api/auth/register
     * Create a new account. Admin endpoint creates ADMIN, API endpoint creates
     * USER.
     */
    @PostMapping({ "${api.base-path}/admin/auth/register", "${api.base-path}/auth/register" })
    public ResponseEntity<?> register(@RequestBody Map<String, String> body, HttpServletRequest request) {
        try {
            String name = body.get("name");
            String email = body.get("email");
            String password = body.get("password");

            if (name == null || name.isBlank())
                return ResponseEntity.badRequest().body(Map.of("message", "Name is required"));
            if (email == null || email.isBlank())
                return ResponseEntity.badRequest().body(Map.of("message", "Email is required"));
            if (password == null || password.length() < 6)
                return ResponseEntity.badRequest().body(Map.of("message", "Password must be at least 6 characters"));

            com.sttl.formbuilder.Enums.Role role = request.getRequestURI().contains("/admin/")
                    ? com.sttl.formbuilder.Enums.Role.ADMIN
                    : com.sttl.formbuilder.Enums.Role.USER;

            User user = userService.register(name, email, password, role);
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("id", user.getId());
            response.put("name", user.getName());
            response.put("email", user.getEmail());
            response.put("role", user.getRole().name());
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            java.util.Map<String, String> error = new java.util.HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * POST /admin/api/auth/login OR /api/auth/login
     * Authenticate and create a session.
     */
    @PostMapping({ "${api.base-path}/admin/auth/login", "${api.base-path}/auth/login" })
    public ResponseEntity<?> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String email = body.get("email");
        String password = body.get("password");

        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, password));

            SecurityContext sc = SecurityContextHolder.createEmptyContext();
            sc.setAuthentication(auth);
            SecurityContextHolder.setContext(sc);

            // Save the security context in the session
            HttpSession session = request.getSession(true);
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, sc);

            User user = (User) auth.getPrincipal();
            return ResponseEntity.ok(getUserResponseMap(user));
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid email or password"));
        }
    }

    private java.util.Map<String, Object> getUserResponseMap(User user) {
        // Collect permissions
        java.util.Set<String> permissions = new java.util.HashSet<>();
        if (user.getRole() == com.sttl.formbuilder.Enums.Role.ADMIN) {
            // Admins get everything
            for (com.sttl.formbuilder.Enums.Permission p : com.sttl.formbuilder.Enums.Permission.values()) {
                permissions.add(p.name());
            }
        } else if (user.getAppRole() != null) {
            for (com.sttl.formbuilder.Enums.Permission p : user.getAppRole().getPermissions()) {
                permissions.add(p.name());
            }
        }

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("id", user.getId());
        response.put("name", user.getName());
        response.put("email", user.getEmail());
        response.put("role", user.getRole().name());
        response.put("appRole", user.getAppRole() != null ? user.getAppRole().getName() : null);
        response.put("permissions", permissions);
        response.put("softDeleteEnabled", user.getSoftDeleteEnabled() != null ? user.getSoftDeleteEnabled() : false);
        response.put("themeConfig", user.getThemeConfig());
        return response;
    }

    /**
     * POST /admin/api/auth/logout OR /api/auth/logout
     * Invalidate the session.
     */
    @PostMapping({ "${api.base-path}/admin/auth/logout", "${api.base-path}/auth/logout" })
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    /**
     * PUT /admin/api/user/settings
     * Update global user settings.
     */
    @PutMapping("${api.base-path}/admin/user/settings")
    public ResponseEntity<?> updateSettings(@AuthenticationPrincipal User principal, @RequestBody Map<String, Object> body) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Not authenticated"));
        }
        User user = userService.getUserById(principal.getId());
        if (body.containsKey("softDeleteEnabled")) {
            boolean enabled = (boolean) body.get("softDeleteEnabled");
            userService.updateSoftDelete(user.getId(), enabled);
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("message", "Settings updated");
            response.put("softDeleteEnabled", enabled);
            return ResponseEntity.ok(response);
        }

        if (body.containsKey("themeConfig")) {
            String themeConfig = (String) body.get("themeConfig");
            userService.updateThemeConfig(user.getId(), themeConfig);
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("message", "Theme settings updated");
            response.put("themeConfig", themeConfig);
            return ResponseEntity.ok(response);
        }
        java.util.Map<String, String> errorResponse = new java.util.HashMap<>();
        errorResponse.put("message", "Invalid settings data");
        return ResponseEntity.badRequest().body(errorResponse);
    }

    /**
     * GET /admin/api/auth/me OR /api/auth/me
     * Get the current logged-in user.
     */
    @GetMapping({ "${api.base-path}/admin/auth/me", "${api.base-path}/auth/me" })
    public ResponseEntity<?> me(@AuthenticationPrincipal User principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Not authenticated"));
        }
        User user = userService.getUserById(principal.getId());
        return ResponseEntity.ok(getUserResponseMap(user));
    }

    // ─── Sub-User Management (Admin only) ────────────────────────────────────────

    /**
     * GET /admin/api/users
     * List all sub-users managed by the current admin.
     */
    @GetMapping("${api.base-path}/admin/users")
    public ResponseEntity<?> getSubUsers(@AuthenticationPrincipal User principal) {
        User adminUser = userService.getUserById(principal.getId());
        List<User> users = userService.getSubUsers(adminUser.getId());
        List<Map<String, Object>> result = users.stream().map(u -> Map.<String, Object>of(
                "id", u.getId(),
                "name", u.getName(),
                "email", u.getEmail(),
                "appRole", u.getAppRole() != null ? Map.of("id", u.getAppRole().getId(), "name", u.getAppRole().getName()) : null,
                "createdDate", u.getCreatedDate()
        )).toList();
        return ResponseEntity.ok(result);
    }

    /**
     * POST /admin/api/users
     * Admin creates a new sub-user with a specific AppRole.
     */
    @PostMapping("${api.base-path}/admin/users")
    public ResponseEntity<?> createSubUser(@RequestBody Map<String, Object> body, @AuthenticationPrincipal User principal) {
        User adminUser = userService.getUserById(principal.getId());
        try {
            String name = (String) body.get("name");
            String email = (String) body.get("email");
            String password = (String) body.get("password");
            String roleIdStr = (String) body.get("appRoleId");

            if (name == null || name.isBlank() || email == null || email.isBlank() || password == null || password.length() < 6 || roleIdStr == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Missing or invalid fields (password min 6 chars, role required)"));
            }

            User subUser = userService.createSubUser(name, email, password, java.util.UUID.fromString(roleIdStr), adminUser);
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("id", subUser.getId());
            response.put("name", subUser.getName());
            response.put("email", subUser.getEmail());
            response.put("appRole", subUser.getAppRole() != null ? subUser.getAppRole().getName() : null);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            java.util.Map<String, String> error = new java.util.HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * PUT /admin/api/users/{id}
     * Admin updates a sub-user's details (name, email, password, appRole).
     */
    @PutMapping("${api.base-path}/admin/users/{id}")
    public ResponseEntity<?> updateSubUser(@PathVariable java.util.UUID id, @RequestBody Map<String, Object> body, @AuthenticationPrincipal User principal) {
        User adminUser = userService.getUserById(principal.getId());
        try {
            String name = (String) body.get("name");
            String email = (String) body.get("email");
            String password = (String) body.get("password");
            String roleIdStr = (String) body.get("appRoleId");

            if (name == null || name.isBlank() || email == null || email.isBlank() || roleIdStr == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Missing or invalid fields (name, email, role required)"));
            }

            User subUser = userService.updateSubUserDetails(id, name, email, password, java.util.UUID.fromString(roleIdStr), adminUser);
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("id", subUser.getId());
            response.put("name", subUser.getName());
            response.put("email", subUser.getEmail());
            response.put("appRole", subUser.getAppRole() != null ? subUser.getAppRole().getName() : null);
            response.put("message", "User updated successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            java.util.Map<String, String> error = new java.util.HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * PUT /admin/api/users/{id}/role
     * Admin updates a sub-user's AppRole.
     */
    @PutMapping("${api.base-path}/admin/users/{id}/role")
    public ResponseEntity<?> updateSubUserRole(@PathVariable java.util.UUID id, @RequestBody Map<String, Object> body, @AuthenticationPrincipal User principal) {
        User adminUser = userService.getUserById(principal.getId());
        try {
            String roleIdStr = (String) body.get("appRoleId");
            if (roleIdStr == null) return ResponseEntity.badRequest().body(Map.of("message", "appRoleId is required"));

            User subUser = userService.updateSubUserRole(id, java.util.UUID.fromString(roleIdStr), adminUser);
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("id", subUser.getId());
            response.put("appRole", subUser.getAppRole() != null ? subUser.getAppRole().getName() : null);
            response.put("message", "Role updated successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            java.util.Map<String, String> error = new java.util.HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * DELETE /admin/api/users/{id}
     * Admin deletes a sub-user.
     */
    @DeleteMapping("${api.base-path}/admin/users/{id}")
    public ResponseEntity<?> deleteSubUser(@PathVariable java.util.UUID id, @AuthenticationPrincipal User principal) {
        User adminUser = userService.getUserById(principal.getId());
        try {
            userService.deleteSubUser(id, adminUser);
            java.util.Map<String, String> response = new java.util.HashMap<>();
            response.put("message", "User deleted successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            java.util.Map<String, String> error = new java.util.HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
