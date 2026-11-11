package com.cybersecurity.cybertraining.controller;

import com.cybersecurity.cybertraining.dto.Requests.AnswerRequest;
import com.cybersecurity.cybertraining.dto.Responses.AnswerResult;
import com.cybersecurity.cybertraining.dto.Responses.AttemptResult;
import com.cybersecurity.cybertraining.dto.Responses.AttemptStart;
import com.cybersecurity.cybertraining.dto.Responses.MessageResponse;
import com.cybersecurity.cybertraining.dto.Responses.ModuleView;
import com.cybersecurity.cybertraining.security.CurrentUser;
import com.cybersecurity.cybertraining.service.ModuleService;
import com.cybersecurity.cybertraining.service.QuizService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Learner (USER role) training endpoints.
 *
 *  GET  /api/learner/modules                    published modules + my progress
 *  POST /api/learner/modules/{id}/attempts      start a quiz attempt
 *  POST /api/learner/attempts/{id}/answers      answer one question
 *  POST /api/learner/attempts/{id}/finish       submit the attempt -> score
 *  POST /api/learner/modules/{id}/restart       reset my progress on a module
 *  GET  /api/learner/attempts                   my quiz history
 */
@RestController
@RequestMapping("/api/learner")
public class LearnerController {

    private final CurrentUser currentUser;
    private final ModuleService moduleService;
    private final QuizService quizService;

    public LearnerController(CurrentUser currentUser, ModuleService moduleService, QuizService quizService) {
        this.currentUser = currentUser;
        this.moduleService = moduleService;
        this.quizService = quizService;
    }

    @GetMapping("/modules")
    public List<ModuleView> modules(Authentication authentication) {
        return moduleService.publishedModulesFor(currentUser.require(authentication));
    }

    @PostMapping("/modules/{moduleId}/attempts")
    public AttemptStart startAttempt(@PathVariable Long moduleId, Authentication authentication) {
        return quizService.start(moduleId, currentUser.require(authentication));
    }

    @PostMapping("/attempts/{attemptId}/answers")
    public AnswerResult answer(
            @PathVariable Long attemptId,
            @RequestBody AnswerRequest request,
            Authentication authentication) {

        if (request == null) {
            throw new IllegalArgumentException("Choose an answer.");
        }
        return quizService.answer(attemptId, request.questionId(), request.answer(),
                currentUser.require(authentication));
    }

    @PostMapping("/attempts/{attemptId}/finish")
    public AttemptResult finish(@PathVariable Long attemptId, Authentication authentication) {
        return quizService.finish(attemptId, currentUser.require(authentication));
    }

    @PostMapping("/modules/{moduleId}/restart")
    public MessageResponse restart(@PathVariable Long moduleId, Authentication authentication) {
        quizService.restart(moduleId, currentUser.require(authentication));
        return new MessageResponse("Progress reset.");
    }

    @GetMapping("/attempts")
    public List<AttemptResult> history(Authentication authentication) {
        return quizService.history(currentUser.require(authentication));
    }
}
