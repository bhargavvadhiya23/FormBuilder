package com.sttl.formbuilder.controller;

import com.sttl.formbuilder.dto.TableMetadataDTO;
import com.sttl.formbuilder.entity.FormVersion;
import com.sttl.formbuilder.entity.User;
import com.sttl.formbuilder.repository.FormVersionRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("${api.base-path}/admin/metadata")
public class MetadataController {

    private final JdbcTemplate jdbcTemplate;
    private final FormVersionRepository formVersionRepository;

    public MetadataController(JdbcTemplate jdbcTemplate, FormVersionRepository formVersionRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.formVersionRepository = formVersionRepository;
    }

    /**
     * Get all submission tables for the current authenticated user.
     */
    @GetMapping("/tables")
    public List<TableMetadataDTO> getTables() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            throw new RuntimeException("User not authenticated");
        }

        UUID userId = user.getId();
        List<FormVersion> publishedVersions = formVersionRepository.findByForm_CreatedBy_IdAndStatusAndForm_DeletedFalse(userId, "PUBLISHED");

        return publishedVersions.stream()
                .filter(v -> v.getTableName() != null && !v.getTableName().isBlank())
                .map(v -> new TableMetadataDTO(v.getTableName(), v.getForm().getName()))
                .collect(Collectors.toList());
    }

    /**
     * Get all columns for a specific table.
     */
    @GetMapping("/columns")
    public List<String> getColumns(@RequestParam String tableName) {
        // Basic validation to prevent SQL injection in metadata queries
        if (!tableName.matches("^[a-zA-Z0-9_]+$")) {
            throw new RuntimeException("Invalid table name");
        }

        String sql = "SELECT column_name FROM information_schema.columns " +
                "WHERE table_schema = 'public' AND table_name = ? " +
                "ORDER BY ordinal_position";
        return jdbcTemplate.queryForList(sql, String.class, tableName);
    }
}
