package com.sttl.formbuilder.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileService {

    private final Path fileStorageLocation;

    public FileService(@Value("${file.upload-dir}") String uploadDir) {
        this.fileStorageLocation = Paths.get(uploadDir)
                .toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            throw new RuntimeException("Could not create the directory where the uploaded files will be stored.", ex);
        }
    }

    public String storeFile(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name == null)
            name = "file";

        // Better filename cleaning for cross-platform
        String originalFileName = StringUtils.getFilename(StringUtils.cleanPath(name));
        if (originalFileName == null)
            originalFileName = "file";

        try {
            System.out.println("Processing upload for file: " + originalFileName);

            // ── Security: File Type and Size Validation ───────────────────────
            long maxSize = 10 * 1024 * 1024; // 10MB default
            if (file.getSize() > maxSize) {
                throw new RuntimeException("File size exceeds the limit of 10MB");
            }

            String contentType = file.getContentType();
            boolean isAllowed = false;
            if (contentType != null) {
                String ct = contentType.toLowerCase();
                if (ct.startsWith("image/") ||
                        ct.equals("application/pdf") ||
                        ct.startsWith("video/") ||
                        ct.startsWith("audio/") ||
                        ct.equals("application/msword") ||
                        ct.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document") ||
                        ct.equals("application/vnd.ms-excel") ||
                        ct.equals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ||
                        ct.equals("text/plain") ||
                        ct.equals("application/zip")) {
                    isAllowed = true;
                }
            }

            if (!isAllowed) {
                throw new RuntimeException("File type not allowed. Please upload images, PDFs, videos, or documents.");
            }
            // ──────────────────────────────────────────────────────────────────
            String fileExtension = "";
            int lastDot = originalFileName.lastIndexOf(".");
            if (lastDot >= 0) {
                fileExtension = originalFileName.substring(lastDot);
                System.out.println("Detected extension from name: " + fileExtension);
            } else {
                // Try guessing from content type
                if (contentType != null) {
                    if (contentType.contains("pdf"))
                        fileExtension = ".pdf";
                    else if (contentType.contains("jpeg"))
                        fileExtension = ".jpg";
                    else if (contentType.contains("png"))
                        fileExtension = ".png";
                    else if (contentType.contains("gif"))
                        fileExtension = ".gif";
                    else if (contentType.contains("mp4"))
                        fileExtension = ".mp4";
                    else if (contentType.contains("mpeg"))
                        fileExtension = ".mp3";
                }
                System.out.println(
                        "Guessed extension from content-type (" + file.getContentType() + "): " + fileExtension);
            }

            String fileName = UUID.randomUUID().toString() + fileExtension;
            System.out.println("Final server filename: " + fileName);

            // Copy file to the target location
            Path targetLocation = this.fileStorageLocation.resolve(fileName);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            return fileName;
        } catch (IOException ex) {
            System.err.println("FAILED to store file " + originalFileName + ": " + ex.getMessage());
            throw new RuntimeException("Could not store file " + originalFileName, ex);
        }
    }

    public Resource loadFileAsResource(String fileName) {
        try {
            Path filePath = this.fileStorageLocation.resolve(fileName).normalize();

            // ── Security: Defence-in-depth path traversal check ──────────────
            // Verify the resolved path is still inside the upload directory.
            // This catches any traversal attempt that slips past the controller.
            if (!filePath.startsWith(this.fileStorageLocation)) {
                throw new RuntimeException("Access denied: invalid file path");
            }

            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists()) {
                return resource;
            } else {
                throw new RuntimeException("File not found");
            }
        } catch (MalformedURLException ex) {
            throw new RuntimeException("File not found", ex);
        }
    }
}
