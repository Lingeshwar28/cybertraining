package com.cybersecurity.cybertraining.controller;

import com.cybersecurity.cybertraining.dto.Requests.ModuleRequest;
import com.cybersecurity.cybertraining.dto.Requests.PublishRequest;
import com.cybersecurity.cybertraining.dto.Requests.QuestionRequest;
import com.cybersecurity.cybertraining.dto.Responses.LearnerProgress;
import com.cybersecurity.cybertraining.dto.Responses.MessageResponse;
import com.cybersecurity.cybertraining.dto.Responses.ModuleView;
import com.cybersecurity.cybertraining.security.CurrentUser;
import com.cybersecurity.cybertraining.service.ModuleService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Module owner (MODULE_OWNER role) endpoints. Owners can only change their own modules.
 *
 *  GET    /api/owner/modules                  my modules (with quiz + stats)
 *  POST   /api/owner/modules                  create
 *  PUT    /api/owner/modules/{id}             edit details / content / video link / certificate
 *  PATCH  /api/owner/modules/{id}/published   publish or unpublish
 *  PUT    /api/owner/modules/{id}/questions   save the quiz
 *  POST   /api/owner/modules/{id}/video       upload a video file
 *  DELETE /api/owner/modules/{id}             delete (only if nobody has attempted it)
 *  GET    /api/owner/learners                 learner progress on my modules
 */
@RestController
@RequestMapping("/api/owner")
public class OwnerController {

    private final CurrentUser currentUser;
    private final ModuleService moduleService;

    public OwnerController(CurrentUser currentUser, ModuleService moduleService) {
        this.currentUser = currentUser;
        this.moduleService = moduleService;
    }

    @GetMapping("/modules")
    public List<ModuleView> myModules(Authentication authentication) {
        return moduleService.modulesOwnedBy(currentUser.require(authentication));
    }

    @PostMapping("/modules")
    @ResponseStatus(HttpStatus.CREATED)
    public ModuleView create(@RequestBody ModuleRequest request, Authentication authentication) {
        return moduleService.create(request, currentUser.require(authentication));
    }

    @PutMapping("/modules/{moduleId}")
    public ModuleView update(
            @PathVariable Long moduleId,
            @RequestBody ModuleRequest request,
            Authentication authentication) {
        return moduleService.update(moduleId, request, currentUser.require(authentication));
    }

    @PatchMapping("/modules/{moduleId}/published")
    public ModuleView publish(
            @PathVariable Long moduleId,
            @RequestBody PublishRequest request,
            Authentication authentication) {
        boolean published = request != null && Boolean.TRUE.equals(request.published());
        return moduleService.setPublished(moduleId, published, currentUser.require(authentication));
    }

    @PutMapping("/modules/{moduleId}/questions")
    public ModuleView saveQuiz(
            @PathVariable Long moduleId,
            @RequestBody List<QuestionRequest> questions,
            Authentication authentication) {
        return moduleService.replaceQuestions(moduleId, questions, currentUser.require(authentication));
    }

    @PostMapping("/modules/{moduleId}/video")
    public ModuleView uploadVideo(
            @PathVariable Long moduleId,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {
        return moduleService.attachVideo(moduleId, file, currentUser.require(authentication));
    }

    @DeleteMapping("/modules/{moduleId}")
    public MessageResponse delete(@PathVariable Long moduleId, Authentication authentication) {
        moduleService.delete(moduleId, currentUser.require(authentication));
        return new MessageResponse("Module deleted.");
    }

    @GetMapping("/learners")
    public List<LearnerProgress> learners(Authentication authentication) {
        return moduleService.learnerProgressFor(currentUser.require(authentication));
    }
}
