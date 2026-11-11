package com.cybersecurity.cybertraining.service;

import com.cybersecurity.cybertraining.dto.Requests.CertTemplateRequest;
import com.cybersecurity.cybertraining.dto.Requests.ModuleRequest;
import com.cybersecurity.cybertraining.dto.Requests.QuestionRequest;
import com.cybersecurity.cybertraining.dto.Responses.CertTemplate;
import com.cybersecurity.cybertraining.dto.Responses.LearnerProgress;
import com.cybersecurity.cybertraining.dto.Responses.ModuleStats;
import com.cybersecurity.cybertraining.dto.Responses.ModuleView;
import com.cybersecurity.cybertraining.dto.Responses.Progress;
import com.cybersecurity.cybertraining.dto.Responses.QuestionView;
import com.cybersecurity.cybertraining.model.Module;
import com.cybersecurity.cybertraining.model.ModuleEnrollment;
import com.cybersecurity.cybertraining.model.Question;
import com.cybersecurity.cybertraining.model.QuizAttempt;
import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.AttemptAnswerRepository;
import com.cybersecurity.cybertraining.repository.ModuleEnrollmentRepository;
import com.cybersecurity.cybertraining.repository.ModuleRepository;
import com.cybersecurity.cybertraining.repository.QuestionRepository;
import com.cybersecurity.cybertraining.repository.QuizAttemptRepository;
import com.cybersecurity.cybertraining.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Everything to do with training modules and their quiz questions:
 * - module owners create / edit / publish / delete their own modules,
 * - learners see published modules with their own progress,
 * - admins see every module with completion statistics.
 */
@Service
public class ModuleService {

    static final String[] LETTERS = {"A", "B", "C", "D"};

    private static final Pattern HEX_COLOUR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final String DEFAULT_COLOUR = "#7c3aed";
    private static final int MAX_CONTENT_LENGTH = 15000;

    private final ModuleRepository moduleRepository;
    private final QuestionRepository questionRepository;
    private final ModuleEnrollmentRepository enrollmentRepository;
    private final QuizAttemptRepository attemptRepository;
    private final AttemptAnswerRepository answerRepository;
    private final UserRepository userRepository;
    private final VideoStorageService videoStorage;
    private final AuditService auditService;

    public ModuleService(
            ModuleRepository moduleRepository,
            QuestionRepository questionRepository,
            ModuleEnrollmentRepository enrollmentRepository,
            QuizAttemptRepository attemptRepository,
            AttemptAnswerRepository answerRepository,
            UserRepository userRepository,
            VideoStorageService videoStorage,
            AuditService auditService) {

        this.moduleRepository = moduleRepository;
        this.questionRepository = questionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.attemptRepository = attemptRepository;
        this.answerRepository = answerRepository;
        this.userRepository = userRepository;
        this.videoStorage = videoStorage;
        this.auditService = auditService;
    }

    // =====================================================================
    // Learner views
    // =====================================================================

    @Transactional(readOnly = true)
    public List<ModuleView> publishedModulesFor(User learner) {
        Map<Long, ModuleEnrollment> enrollments = new HashMap<>();
        for (ModuleEnrollment enrollment : enrollmentRepository.findByUserId(learner.getId())) {
            enrollments.put(enrollment.getModule().getId(), enrollment);
        }

        Map<Long, Integer> bestScores = new HashMap<>();
        for (QuizAttempt attempt : attemptRepository.findByUserIdOrderByStartedAtDesc(learner.getId())) {
            if (attempt.getCompletedAt() != null) {
                bestScores.merge(attempt.getModule().getId(),
                        attempt.getPercentage().intValue(), Math::max);
            }
        }

        List<ModuleView> result = new ArrayList<>();
        for (Module module : moduleRepository.findByPublishedTrueOrderByCreatedAtAsc()) {
            int questionCount = (int) questionRepository.countByModuleIdAndActiveTrue(module.getId());
            Progress progress = progressOf(enrollments.get(module.getId()),
                    bestScores.get(module.getId()), questionCount);
            result.add(toView(module, questionCount, null, progress, null));
        }
        return result;
    }

    // =====================================================================
    // Module owner views and changes
    // =====================================================================

    @Transactional(readOnly = true)
    public List<ModuleView> modulesOwnedBy(User owner) {
        int learnerCount = countLearners();
        List<ModuleView> result = new ArrayList<>();
        for (Module module : moduleRepository.findByOwnerIdOrderByCreatedAtAsc(owner.getId())) {
            result.add(fullView(module, learnerCount));
        }
        return result;
    }

    @Transactional
    public ModuleView create(ModuleRequest request, User owner) {
        Module module = new Module();
        module.setOwner(owner);
        module.setPublished(false);
        applyDetails(module, request);

        Module saved = moduleRepository.save(module);
        auditService.record(owner, "MODULE_CREATED", "Module", saved.getId(), saved.getTitle());
        return fullView(saved, countLearners());
    }

    @Transactional
    public ModuleView update(Long moduleId, ModuleRequest request, User owner) {
        Module module = requireOwned(moduleId, owner);
        String oldVideoFile = module.getVideoFile();

        applyDetails(module, request);

        // If the owner removed or replaced an uploaded video, delete the old file.
        if (oldVideoFile != null && !internalVideoUrl(module.getId()).equals(module.getVideoUrl())) {
            module.setVideoFile(null);
            videoStorage.delete(oldVideoFile);
        }

        moduleRepository.save(module);
        auditService.record(owner, "MODULE_UPDATED", "Module", module.getId(), module.getTitle());
        return fullView(module, countLearners());
    }

    @Transactional
    public ModuleView setPublished(Long moduleId, boolean published, User owner) {
        Module module = requireOwned(moduleId, owner);

        if (published && questionRepository.countByModuleIdAndActiveTrue(moduleId) == 0) {
            throw new IllegalArgumentException("Add at least one quiz question before publishing this module.");
        }

        module.setPublished(published);
        moduleRepository.save(module);
        auditService.record(owner, published ? "MODULE_PUBLISHED" : "MODULE_UNPUBLISHED",
                "Module", moduleId, module.getTitle());
        return fullView(module, countLearners());
    }

    /**
     * Replaces the module's quiz with the list sent by the owner.
     * Questions that learners have already answered are hidden (not deleted)
     * so old quiz results stay correct.
     */
    @Transactional
    public ModuleView replaceQuestions(Long moduleId, List<QuestionRequest> requests, User owner) {
        Module module = requireOwned(moduleId, owner);

        if (requests == null || requests.isEmpty()) {
            throw new IllegalArgumentException("A quiz needs at least one question.");
        }
        if (requests.size() > 50) {
            throw new IllegalArgumentException("A quiz can have at most 50 questions.");
        }

        Map<Long, Question> existing = new HashMap<>();
        for (Question question : questionRepository.findByModuleIdOrderByQuestionOrderAsc(moduleId)) {
            existing.put(question.getId(), question);
        }

        Set<Long> kept = new HashSet<>();
        int order = 1;

        for (QuestionRequest request : requests) {
            validateQuestion(request, order);

            Question question = request.id() != null ? existing.get(request.id()) : null;
            if (question == null) {
                question = new Question();
                question.setModule(module);
            } else {
                kept.add(question.getId());
            }

            question.setQuestionText(request.q().trim());
            question.setOptionA(request.options().get(0).trim());
            question.setOptionB(request.options().get(1).trim());
            question.setOptionC(request.options().get(2).trim());
            question.setOptionD(request.options().get(3).trim());
            question.setCorrectAnswer(LETTERS[request.answer()]);
            question.setHint(trimToNull(request.hint(), 1000));
            question.setExplanation(trimToNull(request.explanation(), 1000));
            question.setQuestionOrder(order);
            question.setActive(true);
            questionRepository.save(question);
            order++;
        }

        for (Question old : existing.values()) {
            if (kept.contains(old.getId())) {
                continue;
            }
            if (answerRepository.existsByQuestionId(old.getId())) {
                old.setActive(false);
                questionRepository.save(old);
            } else {
                questionRepository.delete(old);
            }
        }

        auditService.record(owner, "QUIZ_UPDATED", "Module", moduleId,
                module.getTitle() + " now has " + requests.size() + " question(s)");
        return fullView(module, countLearners());
    }

    @Transactional
    public ModuleView attachVideo(Long moduleId, MultipartFile file, User owner) {
        Module module = requireOwned(moduleId, owner);
        String storedName = videoStorage.store(file);

        String oldFile = module.getVideoFile();
        module.setVideoFile(storedName);
        module.setVideoUrl(internalVideoUrl(moduleId));
        String name = file.getOriginalFilename() == null ? "Uploaded video" : file.getOriginalFilename();
        module.setVideoName(name.length() > 255 ? name.substring(0, 255) : name);
        moduleRepository.save(module);
        videoStorage.delete(oldFile);

        auditService.record(owner, "VIDEO_UPLOADED", "Module", moduleId, module.getVideoName());
        return fullView(module, countLearners());
    }

    /**
     * Deletes a module only when no learner has attempted it yet.
     * Otherwise learners' results would be lost, so the owner should unpublish instead.
     */
    @Transactional
    public void delete(Long moduleId, User owner) {
        Module module = requireOwned(moduleId, owner);

        if (attemptRepository.existsByModuleId(moduleId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Learners have already taken this quiz, so the module is kept for their records. Unpublish it instead.");
        }

        enrollmentRepository.deleteByModuleId(moduleId);
        questionRepository.deleteAll(questionRepository.findByModuleIdOrderByQuestionOrderAsc(moduleId));
        String videoFile = module.getVideoFile();
        moduleRepository.delete(module);
        videoStorage.delete(videoFile);

        auditService.record(owner, "MODULE_DELETED", "Module", moduleId, module.getTitle());
    }

    /** Progress of every approved learner on this owner's modules. */
    @Transactional(readOnly = true)
    public List<LearnerProgress> learnerProgressFor(User owner) {
        List<Module> modules = moduleRepository.findByOwnerIdOrderByCreatedAtAsc(owner.getId());

        // userId -> (moduleId -> progress)
        Map<Long, Map<Long, Progress>> byUser = new HashMap<>();

        for (Module module : modules) {
            int questionCount = (int) questionRepository.countByModuleIdAndActiveTrue(module.getId());

            Map<Long, Integer> bestScores = new HashMap<>();
            for (QuizAttempt attempt : attemptRepository.findByModuleIdAndCompletedAtIsNotNull(module.getId())) {
                bestScores.merge(attempt.getUser().getId(), attempt.getPercentage().intValue(), Math::max);
            }

            for (ModuleEnrollment enrollment : enrollmentRepository.findByModuleId(module.getId())) {
                Long userId = enrollment.getUser().getId();
                byUser.computeIfAbsent(userId, id -> new LinkedHashMap<>())
                        .put(module.getId(), progressOf(enrollment, bestScores.get(userId), questionCount));
            }
        }

        List<LearnerProgress> result = new ArrayList<>();
        for (User learner : activeLearners()) {
            result.add(new LearnerProgress(learner.getId(), learner.getFullName(), learner.getEmail(),
                    byUser.getOrDefault(learner.getId(), Map.of())));
        }
        return result;
    }

    // =====================================================================
    // Admin view
    // =====================================================================

    @Transactional(readOnly = true)
    public List<ModuleView> allModulesWithStats() {
        int learnerCount = countLearners();
        List<ModuleView> result = new ArrayList<>();
        for (Module module : moduleRepository.findAllByOrderByCreatedAtAsc()) {
            int questionCount = (int) questionRepository.countByModuleIdAndActiveTrue(module.getId());
            result.add(toView(module, questionCount, null, null, statsOf(module.getId(), learnerCount)));
        }
        return result;
    }

    // =====================================================================
    // Shared helpers
    // =====================================================================

    public static String internalVideoUrl(Long moduleId) {
        return "/api/modules/" + moduleId + "/video";
    }

    Module requireOwned(Long moduleId, User owner) {
        Module module = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found."));

        if (module.getOwner() == null || !module.getOwner().getId().equals(owner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only change your own modules.");
        }
        return module;
    }

    static Progress progressOf(ModuleEnrollment enrollment, Integer bestScore, int questionCount) {
        if (enrollment == null) {
            return new Progress(false, false, bestScore, null, 0, 0);
        }
        int percentage = enrollment.isCompleted() ? 100 : enrollment.getProgressPercentage();
        int currentQ = Math.round(percentage * questionCount / 100f);
        return new Progress(true, enrollment.isCompleted(), bestScore,
                Dates.text(enrollment.getCompletedAt()), currentQ, percentage);
    }

    private ModuleView fullView(Module module, int learnerCount) {
        List<QuestionView> quiz = questionRepository
                .findByModuleIdAndActiveTrueOrderByQuestionOrderAsc(module.getId())
                .stream()
                .map(question -> toQuestionView(question, true))
                .toList();
        return toView(module, quiz.size(), quiz, null, statsOf(module.getId(), learnerCount));
    }

    private ModuleStats statsOf(Long moduleId, int learnerCount) {
        int completed = 0;
        int started = 0;
        for (ModuleEnrollment enrollment : enrollmentRepository.findByModuleId(moduleId)) {
            if (enrollment.isCompleted()) {
                completed++;
            } else {
                started++;
            }
        }
        int pct = learnerCount == 0 ? 0 : Math.min(100, Math.round(completed * 100f / learnerCount));
        return new ModuleStats(learnerCount, completed, started, pct);
    }

    private List<User> activeLearners() {
        return userRepository.findByRoleOrderByFullNameAsc(UserService.ROLE_USER).stream()
                .filter(user -> user.isEnabled() && "APPROVED".equalsIgnoreCase(user.getApprovalStatus()))
                .toList();
    }

    private int countLearners() {
        return activeLearners().size();
    }

    static QuestionView toQuestionView(Question question, boolean includeAnswer) {
        List<String> options = List.of(
                question.getOptionA(), question.getOptionB(), question.getOptionC(), question.getOptionD());
        return new QuestionView(
                question.getId(),
                question.getQuestionText(),
                options,
                includeAnswer ? answerIndex(question) : null,
                question.getHint(),
                includeAnswer ? question.getExplanation() : null);
    }

    static int answerIndex(Question question) {
        String letter = question.getCorrectAnswer() == null ? "A" : question.getCorrectAnswer().trim().toUpperCase();
        for (int i = 0; i < LETTERS.length; i++) {
            if (LETTERS[i].equals(letter)) {
                return i;
            }
        }
        return 0;
    }

    private static ModuleView toView(Module module, int questionCount, List<QuestionView> quiz,
                                     Progress progress, ModuleStats stats) {
        CertTemplate cert = new CertTemplate(
                blankToDefault(module.getCertTitle(), "Certificate of Completion"),
                blankToDefault(module.getCertSubtitle(), module.getTitle()),
                blankToDefault(module.getCertBadge(), "🏆"),
                blankToDefault(module.getCertAccentColor(), colourOf(module)));

        return new ModuleView(
                module.getId(),
                module.getTitle(),
                module.getDescription(),
                module.getContent(),
                blankToDefault(module.getCategory(), "General"),
                module.getDurationMinutes() > 0 ? module.getDurationMinutes() : 20,
                Dates.text(module.getDueDate()),
                blankToDefault(module.getThumbnail(), "🔒"),
                colourOf(module),
                module.getVideoUrl(),
                module.getVideoName(),
                module.getPassingScore(),
                module.isPublished(),
                questionCount,
                module.getOwner() == null ? null : module.getOwner().getFullName(),
                cert,
                quiz,
                progress,
                stats);
    }

    private static String colourOf(Module module) {
        return module.getColor() != null && HEX_COLOUR.matcher(module.getColor()).matches()
                ? module.getColor() : DEFAULT_COLOUR;
    }

    private void applyDetails(Module module, ModuleRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Module details are missing.");
        }

        String title = request.title() == null ? "" : request.title().trim();
        if (title.length() < 3 || title.length() > 200) {
            throw new IllegalArgumentException("Module title must be between 3 and 200 characters.");
        }

        String description = request.desc() == null ? "" : request.desc().trim();
        if (description.length() > 1000) {
            throw new IllegalArgumentException("Description can be at most 1000 characters.");
        }

        String content = request.content() == null ? "" : request.content().trim();
        if (content.length() > MAX_CONTENT_LENGTH) {
            throw new IllegalArgumentException("Training content can be at most " + MAX_CONTENT_LENGTH + " characters.");
        }

        int duration = request.duration() == null ? 20 : request.duration();
        if (duration < 1 || duration > 600) {
            throw new IllegalArgumentException("Duration must be between 1 and 600 minutes.");
        }

        int passingScore = request.passingScore() == null ? module.getPassingScore() : request.passingScore();
        if (passingScore < 1 || passingScore > 100) {
            throw new IllegalArgumentException("Passing score must be between 1 and 100 percent.");
        }

        module.setTitle(title);
        module.setDescription(description);
        module.setContent(content);
        module.setCategory(trimToNull(request.category(), 60));
        module.setDurationMinutes(duration);
        module.setDueDate(Dates.parseDate(request.dueDate()));
        module.setThumbnail(trimToNull(request.thumbnail(), 16));
        module.setColor(request.color() != null && HEX_COLOUR.matcher(request.color().trim()).matches()
                ? request.color().trim() : DEFAULT_COLOUR);
        module.setPassingScore(passingScore);

        applyVideoLink(module, request.videoUrl(), request.videoName());

        CertTemplateRequest cert = request.certTemplate();
        if (cert != null) {
            module.setCertTitle(trimToNull(cert.title(), 255));
            module.setCertSubtitle(trimToNull(cert.subtitle(), 255));
            module.setCertBadge(trimToNull(cert.badge(), 16));
            module.setCertAccentColor(cert.accentColor() != null
                    && HEX_COLOUR.matcher(cert.accentColor().trim()).matches() ? cert.accentColor().trim() : null);
        }
    }

    /** Accepts only http(s) links (or this module's own uploaded video), never javascript: etc. */
    private static void applyVideoLink(Module module, String videoUrl, String videoName) {
        String url = videoUrl == null ? "" : videoUrl.trim();

        if (url.isEmpty()) {
            module.setVideoUrl(null);
            module.setVideoName(null);
            return;
        }

        boolean ownUpload = module.getId() != null && url.equals(internalVideoUrl(module.getId()));
        boolean webLink = url.matches("(?i)^https?://[^\\s<>\"']+$");

        if (!ownUpload && !webLink) {
            throw new IllegalArgumentException("Video link must start with http:// or https://");
        }
        if (url.length() > 1000) {
            throw new IllegalArgumentException("Video link is too long.");
        }

        module.setVideoUrl(url);
        module.setVideoName(trimToNull(videoName, 255) == null && webLink ? "Linked video" : trimToNull(videoName, 255));
    }

    private static void validateQuestion(QuestionRequest request, int number) {
        String prefix = "Question " + number + ": ";
        if (request == null || request.q() == null || request.q().isBlank()) {
            throw new IllegalArgumentException(prefix + "enter the question text.");
        }
        if (request.q().trim().length() > 1000) {
            throw new IllegalArgumentException(prefix + "question text is too long (max 1000 characters).");
        }
        if (request.options() == null || request.options().size() != 4) {
            throw new IllegalArgumentException(prefix + "exactly four answer options are required.");
        }
        for (String option : request.options()) {
            if (option == null || option.isBlank()) {
                throw new IllegalArgumentException(prefix + "fill in all four answer options.");
            }
            if (option.trim().length() > 1000) {
                throw new IllegalArgumentException(prefix + "an answer option is too long (max 1000 characters).");
            }
        }
        if (request.answer() == null || request.answer() < 0 || request.answer() > 3) {
            throw new IllegalArgumentException(prefix + "mark which option is correct.");
        }
    }

    static String trimToNull(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }

    private static String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
