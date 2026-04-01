package com.sttl.formbuilder.controller;

import com.sttl.formbuilder.service.FileService;
import org.springframework.core.io.Resource;

import java.io.IOException;
import java.nio.file.Files;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("${api.base-path}/files")
public class FileController {

    private final FileService fileService;

    public FileController(FileService fileService) {
        this.fileService = fileService;
    }

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadFile(@RequestParam("file") MultipartFile file) {
        String fileName = fileService.storeFile(file);

        Map<String, String> response = new HashMap<>();
        response.put("fileName", fileName);
        response.put("originalName", file.getOriginalFilename());
        response.put("contentType", file.getContentType());
        response.put("size", String.valueOf(file.getSize()));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/download/{fileName:.+}")
    public ResponseEntity<Resource> downloadFile(
            @PathVariable String fileName,
            @RequestParam(value = "dName", required = false) String dName) {

        // ── Security Fix #1: Path Traversal ──────────────────────────────────
        // Reject any fileName containing path separators or parent-directory
        // traversal sequences before it even reaches FileService.
        if (fileName == null || fileName.isBlank()
                || fileName.contains("..")
                || fileName.contains("/")
                || fileName.contains("\\")
                || fileName.contains("%2e") // URL-encoded dot
                || fileName.contains("%2f") // URL-encoded /
                || fileName.contains("%5c")) { // URL-encoded \
            return ResponseEntity.badRequest().build();
        }

        // Load file as Resource (FileService also validates the resolved path
        // stays within the upload directory via startsWith check)
        Resource resource = fileService.loadFileAsResource(fileName);

        // Try to determine file's content type
        String contentType = null;
        try {
            contentType = Files.probeContentType(resource.getFile().toPath());
        } catch (IOException ex) {
            // Fallback
        }

        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        // ── Security Fix #2: dName Header Injection ───────────────────────────
        // Only allow safe filename characters in the download name.
        // Strip everything that is not a letter, digit, dot, dash, or underscore.
        String resName = resource.getFilename();
        String downloadName = (dName != null && !dName.isEmpty()) ? dName : (resName != null ? resName : "file");

        // Append extension from disk name if the display name has none
        if (!downloadName.contains(".") && resName != null && resName.contains(".")) {
            String diskExt = resName.substring(resName.lastIndexOf("."));
            downloadName += diskExt;
        }

        // Whitelist: keep only safe characters, collapse the rest to underscore
        String finalName = downloadName
                .replaceAll("[^\\p{L}\\p{N}._\\-]", "_") // safe chars only
                .replaceAll("_{2,}", "_") // collapse consecutive underscores
                .replaceAll("^_+|_+$", ""); // trim leading/trailing underscores

        if (finalName.isBlank())
            finalName = "file";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + finalName + "\"")
                .body(resource);
    }
}
