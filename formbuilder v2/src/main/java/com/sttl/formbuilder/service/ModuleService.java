package com.sttl.formbuilder.service;

import com.sttl.formbuilder.Enums.Role;
import com.sttl.formbuilder.entity.AppRole;
import com.sttl.formbuilder.entity.Module;
import com.sttl.formbuilder.entity.User;
import com.sttl.formbuilder.repository.ModuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ModuleService {

    private final ModuleRepository moduleRepository;

    public List<Module> getAllModules() {
        return moduleRepository.findAll();
    }

    public List<Module> getActiveModules() {
        return moduleRepository.findByActiveStatusTrue();
    }

    public Module createModule(Module module) {
        return moduleRepository.save(module);
    }

    public Module updateModule(UUID id, Module moduleDetails) {
        Module module = getModuleById(id);
        module.setName(moduleDetails.getName());
        module.setRoutePrefix(moduleDetails.getRoutePrefix());
        module.setDescription(moduleDetails.getDescription());
        module.setIconClass(moduleDetails.getIconClass());
        module.setPageLink(moduleDetails.getPageLink());
        module.setActiveStatus(moduleDetails.isActiveStatus());
        module.setParent(moduleDetails.isParent());
        module.setParentId(moduleDetails.getParentId());
        return moduleRepository.save(module);
    }

    public void deleteModule(UUID id) {
        Module module = getModuleById(id);
        
        // Prevent deletion if it has children
        List<Module> children = moduleRepository.findByParentId(id);
        if (!children.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete module that has sub-modules. Delete children first.");
        }
        
        moduleRepository.delete(module);
    }

    public Module getModuleById(UUID id) {
        return moduleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found"));
    }

    /**
     * Checks if a user has access to a specific module.
     */
    public boolean checkAccess(User user, UUID moduleId) {
        if (user.getRole() == Role.ADMIN) return true;
        
        AppRole appRole = user.getAppRole();
        if (appRole == null) return false;
        
        return appRole.getModules().stream()
                .anyMatch(m -> m.getId().equals(moduleId));
    }
}
