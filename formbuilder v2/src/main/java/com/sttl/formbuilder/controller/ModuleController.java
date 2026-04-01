package com.sttl.formbuilder.controller;

import com.sttl.formbuilder.entity.AppRole;
import com.sttl.formbuilder.entity.Module;
import com.sttl.formbuilder.entity.User;
import com.sttl.formbuilder.service.ModuleService;
import com.sttl.formbuilder.service.UserService;
import com.sttl.formbuilder.repository.AppRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("${api.base-path}/modules")
@RequiredArgsConstructor
public class ModuleController {

    private final ModuleService moduleService;
    private final UserService userService;
    private final AppRoleRepository appRoleRepository;

    /**
     * Get all active modules assigned to the current user's role.
     */
    @GetMapping("/my")
    @Transactional(readOnly = true)
    public ResponseEntity<List<com.sttl.formbuilder.entity.Module>> getMyModules(@AuthenticationPrincipal User userPrincipal) {
        if (userPrincipal == null) return ResponseEntity.status(401).build();
        
        User user = userService.getUserById(userPrincipal.getId());
        AppRole appRole = user.getAppRole();
        
        // If user is ADMIN but has no specific AppRole linked, fallback to the system "Admin" role
        if (appRole == null && user.getRole() == com.sttl.formbuilder.Enums.Role.ADMIN) {
            // 1. Try exact match
            appRole = appRoleRepository.findByName("Admin").orElse(null);
            
            // 2. Try case-insensitive or any system role named "admin"
            if (appRole == null) {
                appRole = appRoleRepository.findAll().stream()
                        .filter(r -> r.isSystem() && "admin".equalsIgnoreCase(r.getName()))
                        .findFirst()
                        .orElse(null);
            }
            
            // 3. Last resort: ANY system role (usually seeding creates Admin first)
            if (appRole == null) {
                appRole = appRoleRepository.findAll().stream()
                        .filter(AppRole::isSystem)
                        .findFirst()
                        .orElse(null);
            }
        }
        
        if (appRole == null) {
            return ResponseEntity.ok(List.of());
        }
        
        // Return only modules that are active and assigned to the user's role
        // Stream inside transaction ensures lazy collection is loaded
        List<Module> assignedModules = appRole.getModules().stream()
                .filter(Module::isActiveStatus)
                .collect(Collectors.toList());
                
        return ResponseEntity.ok(assignedModules);
    }

    /**
     * ADMIN ENDPOINTS (Management)
     */
    
    @GetMapping("/admin/all")
    public ResponseEntity<List<Module>> getAllModules() {
        return ResponseEntity.ok(moduleService.getAllModules());
    }

    @PostMapping("/admin")
    public ResponseEntity<Module> createModule(@RequestBody Module module) {
        return ResponseEntity.ok(moduleService.createModule(module));
    }

    @PutMapping("/admin/{id}")
    public ResponseEntity<Module> updateModule(@PathVariable UUID id, @RequestBody Module module) {
        return ResponseEntity.ok(moduleService.updateModule(id, module));
    }

    @DeleteMapping("/admin/{id}")
    public ResponseEntity<Void> deleteModule(@PathVariable UUID id) {
        moduleService.deleteModule(id);
        return ResponseEntity.noContent().build();
    }
}
