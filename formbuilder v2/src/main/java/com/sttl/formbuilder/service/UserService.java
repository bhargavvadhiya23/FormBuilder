package com.sttl.formbuilder.service;

import com.sttl.formbuilder.Enums.Role;
import com.sttl.formbuilder.entity.AppRole;
import com.sttl.formbuilder.entity.User;
import com.sttl.formbuilder.repository.AppRoleRepository;
import com.sttl.formbuilder.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService implements UserDetailsService {

    private final UserRepository userRepository;
    private final AppRoleRepository appRoleRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Register a new user with a specific Spring Security role.
     * Used for /api/auth/register and /admin/api/auth/register endpoints.
     */
    public User register(String name, String email, String password, Role role) {
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email already registered: " + email);
        }
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(role);
        return userRepository.save(user);
    }

    /**
     * Admin creates a sub-user with a specified AppRole.
     * Sub-user gets Spring Security role = USER, linked to the creating admin.
     */
    public User createSubUser(String name, String email, String password, UUID appRoleId, User adminUser) {
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered: " + email);
        }
        AppRole appRole = appRoleRepository.findById(appRoleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found: " + appRoleId));

        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(Role.USER);
        user.setAppRole(appRole);
        user.setCreatedByAdmin(adminUser);
        return userRepository.save(user);
    }

    /**
     * Returns all sub-users created by this admin.
     */
    public List<User> getSubUsers(UUID adminId) {
        return userRepository.findByCreatedByAdmin_Id(adminId);
    }

    /**
     * Updates the AppRole of a sub-user. Admin must own the sub-user.
     */
    public User updateSubUserRole(UUID userId, UUID appRoleId, User adminUser) {
        User user = getUserById(userId);
        if (user.getCreatedByAdmin() == null || !user.getCreatedByAdmin().getId().equals(adminUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not manage this user");
        }
        AppRole appRole = appRoleRepository.findById(appRoleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found: " + appRoleId));
        user.setAppRole(appRole);
        return userRepository.save(user);
    }

    /**
     * Updates the details of a sub-user (name, email, password, role).
     */
    public User updateSubUserDetails(UUID userId, String name, String email, String password, UUID appRoleId, User adminUser) {
        User user = getUserById(userId);
        if (user.getCreatedByAdmin() == null || !user.getCreatedByAdmin().getId().equals(adminUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not manage this user");
        }
        
        AppRole appRole = appRoleRepository.findById(appRoleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found: " + appRoleId));
        
        // Optional unique email check if updating to a new email
        if (!user.getEmail().equals(email) && userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered: " + email);
        }

        user.setName(name);
        user.setEmail(email);
        
        if (password != null && !password.isBlank()) {
            user.setPassword(passwordEncoder.encode(password));
        }
        
        user.setAppRole(appRole);
        return userRepository.save(user);
    }

    /**
     * Deletes a sub-user. Admin must own the sub-user.
     */
    public void deleteSubUser(UUID userId, User adminUser) {
        User user = getUserById(userId);
        if (user.getCreatedByAdmin() == null || !user.getCreatedByAdmin().getId().equals(adminUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not manage this user");
        }
        userRepository.delete(user);
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }

    public User getUserById(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found: " + id));
    }

    public User updateSoftDelete(UUID userId, boolean enabled) {
        User user = getUserById(userId);
        user.setSoftDeleteEnabled(enabled);
        return userRepository.save(user);
    }

    public User updateThemeConfig(UUID userId, String themeConfig) {
        User user = getUserById(userId);
        user.setThemeConfig(themeConfig);
        return userRepository.save(user);
    }
}
