package com.carpool.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Slf4j
@Service
public class UploadService {

    @Value("${upload.dir:uploads}")
    private String uploadDir;

    @Value("${upload.base-url:http://localhost:8080}")
    private String baseUrl;

    public String store(MultipartFile file) throws IOException {
        Path dir = Paths.get(uploadDir).toAbsolutePath();
        Files.createDirectories(dir);

        String ext = "";
        String original = file.getOriginalFilename();
        if (original != null && original.contains(".")) {
            ext = original.substring(original.lastIndexOf('.'));
        }

        String filename = UUID.randomUUID() + ext;
        Files.copy(file.getInputStream(), dir.resolve(filename));

        return "/uploads/" + filename;
    }

    public void deleteFile(String url) {
        if (url == null || !url.startsWith("/uploads/")) return;
        String filename = url.substring("/uploads/".length());
        if (filename.isBlank()) return;
        try {
            Path file = Paths.get(uploadDir).toAbsolutePath().resolve(filename).normalize();
            Files.deleteIfExists(file);
            log.info("Deleted upload file: {}", filename);
        } catch (IOException e) {
            log.warn("Could not delete upload file {}: {}", filename, e.getMessage());
        }
    }
}
