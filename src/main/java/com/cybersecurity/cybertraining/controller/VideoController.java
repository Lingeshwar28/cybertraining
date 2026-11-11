package com.cybersecurity.cybertraining.controller;

import com.cybersecurity.cybertraining.model.Module;
import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.ModuleRepository;
import com.cybersecurity.cybertraining.security.CurrentUser;
import com.cybersecurity.cybertraining.service.UserService;
import com.cybersecurity.cybertraining.service.VideoStorageService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Streams an uploaded training video (GET /api/modules/{id}/video).
 * Learners can watch published modules; owners their own; admins any.
 * Spring handles "Range" requests automatically, so videos can be skipped through.
 */
@RestController
public class VideoController {

    private final ModuleRepository moduleRepository;
    private final VideoStorageService videoStorage;
    private final CurrentUser currentUser;

    public VideoController(ModuleRepository moduleRepository, VideoStorageService videoStorage,
                           CurrentUser currentUser) {
        this.moduleRepository = moduleRepository;
        this.videoStorage = videoStorage;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/modules/{moduleId}/video")
    @Transactional(readOnly = true)
    public ResponseEntity<Resource> video(@PathVariable Long moduleId, Authentication authentication) {
        User user = currentUser.require(authentication);
        Module module = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found."));

        boolean isOwner = module.getOwner() != null && module.getOwner().getId().equals(user.getId());
        boolean isAdmin = UserService.ROLE_ADMIN.equals(user.getRole());

        if (!(module.isPublished() || isOwner || isAdmin) || module.getVideoFile() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Video not found.");
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(videoStorage.contentType(module.getVideoFile())))
                .body(videoStorage.load(module.getVideoFile()));
    }
}
