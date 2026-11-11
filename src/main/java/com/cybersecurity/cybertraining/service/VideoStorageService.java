package com.cybersecurity.cybertraining.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Saves uploaded training videos in a folder on disk (default: ./uploads/videos).
 * Only the generated file name is stored in MySQL, not the video itself.
 */
@Service
public class VideoStorageService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("mp4", "webm", "ogg", "mov", "m4v");

    private final Path videoFolder;

    public VideoStorageService(@Value("${app.upload-dir:uploads}") String uploadDir) {
        this.videoFolder = Paths.get(uploadDir, "videos").toAbsolutePath().normalize();
    }

    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Choose a video file to upload.");
        }

        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        int dot = originalName.lastIndexOf('.');
        String extension = dot >= 0 ? originalName.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
        String contentType = file.getContentType() == null ? "" : file.getContentType();

        if (!ALLOWED_EXTENSIONS.contains(extension) || !contentType.startsWith("video/")) {
            throw new IllegalArgumentException("Only MP4, WebM, OGG, MOV or M4V video files can be uploaded.");
        }

        String storedName = UUID.randomUUID() + "." + extension;

        try {
            Files.createDirectories(videoFolder);
            try (InputStream input = file.getInputStream()) {
                Files.copy(input, resolve(storedName), StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "The video could not be saved on the server.");
        }

        return storedName;
    }

    public Resource load(String storedName) {
        Path path = resolve(storedName);
        if (!Files.isReadable(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Video file not found.");
        }
        return new FileSystemResource(path);
    }

    public String contentType(String storedName) {
        String lower = storedName.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".webm")) return "video/webm";
        if (lower.endsWith(".ogg")) return "video/ogg";
        if (lower.endsWith(".mov")) return "video/quicktime";
        return "video/mp4";
    }

    public void delete(String storedName) {
        if (storedName == null || storedName.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(resolve(storedName));
        } catch (IOException ignored) {
            // A leftover file is harmless; nothing else to do.
        }
    }

    /** Stops "../" tricks: the file must stay inside the videos folder. */
    private Path resolve(String storedName) {
        Path path = videoFolder.resolve(storedName).normalize();
        if (!path.startsWith(videoFolder)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file name.");
        }
        return path;
    }
}
