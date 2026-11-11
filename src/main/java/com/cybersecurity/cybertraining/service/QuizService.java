package com.cybersecurity.cybertraining.service;

import com.cybersecurity.cybertraining.dto.Responses.AnswerResult;
import com.cybersecurity.cybertraining.dto.Responses.AttemptResult;
import com.cybersecurity.cybertraining.dto.Responses.AttemptStart;
import com.cybersecurity.cybertraining.dto.Responses.QuestionView;
import com.cybersecurity.cybertraining.model.AttemptAnswer;
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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Quiz attempts are marked on the server:
 *  1. start  -> creates a quiz_attempts row and sends the questions WITHOUT answers,
 *  2. answer -> saves one answer (it cannot be changed afterwards) and tells the learner
 *               whether it was right,
 *  3. finish -> calculates the score; if it reaches the module's passing score the
 *               module is marked completed in module_enrollments.
 */
@Service
public class QuizService {

    private final ModuleRepository moduleRepository;
    private final QuestionRepository questionRepository;
    private final QuizAttemptRepository attemptRepository;
    private final AttemptAnswerRepository answerRepository;
    private final ModuleEnrollmentRepository enrollmentRepository;

    public QuizService(
            ModuleRepository moduleRepository,
            QuestionRepository questionRepository,
            QuizAttemptRepository attemptRepository,
            AttemptAnswerRepository answerRepository,
            ModuleEnrollmentRepository enrollmentRepository) {

        this.moduleRepository = moduleRepository;
        this.questionRepository = questionRepository;
        this.attemptRepository = attemptRepository;
        this.answerRepository = answerRepository;
        this.enrollmentRepository = enrollmentRepository;
    }

    @Transactional
    public AttemptStart start(Long moduleId, User learner) {
        Module module = requirePublished(moduleId);

        List<Question> questions =
                questionRepository.findByModuleIdAndActiveTrueOrderByQuestionOrderAsc(moduleId);
        if (questions.isEmpty()) {
            throw new IllegalArgumentException("This module does not have any quiz questions yet.");
        }

        QuizAttempt attempt = new QuizAttempt();
        attempt.setUser(learner);
        attempt.setModule(module);
        attempt.setStartedAt(LocalDateTime.now());
        attempt.setTotalQuestions(questions.size());
        attempt = attemptRepository.save(attempt);

        ModuleEnrollment enrollment = enrollmentFor(learner, module);
        if (!enrollment.isCompleted()) {
            enrollment.setProgressPercentage(0);
        }
        enrollmentRepository.save(enrollment);

        List<QuestionView> views = questions.stream()
                .map(question -> ModuleService.toQuestionView(question, false))
                .toList();

        return new AttemptStart(attempt.getId(), moduleId, views);
    }

    @Transactional
    public AnswerResult answer(Long attemptId, Long questionId, Integer answerIndex, User learner) {
        QuizAttempt attempt = requireOpenAttempt(attemptId, learner);

        if (questionId == null || answerIndex == null || answerIndex < 0 || answerIndex > 3) {
            throw new IllegalArgumentException("Choose one of the four answers.");
        }

        Question question = questionRepository.findById(questionId)
                .filter(q -> q.getModule().getId().equals(attempt.getModule().getId()) && q.isActive())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "That question is not part of this quiz."));

        if (answerRepository.existsByAttemptIdAndQuestionId(attemptId, questionId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This question has already been answered.");
        }

        int correctIndex = ModuleService.answerIndex(question);
        boolean correct = correctIndex == answerIndex;

        AttemptAnswer answer = new AttemptAnswer();
        answer.setAttempt(attempt);
        answer.setQuestion(question);
        answer.setSelectedAnswer(ModuleService.LETTERS[answerIndex]);
        answer.setCorrect(correct);
        answerRepository.save(answer);

        int answered = answerRepository.findByAttemptId(attemptId).size();
        int total = attempt.getTotalQuestions();

        ModuleEnrollment enrollment = enrollmentFor(learner, attempt.getModule());
        if (!enrollment.isCompleted()) {
            enrollment.setProgressPercentage(Math.min(99, Math.round(answered * 100f / Math.max(1, total))));
            enrollmentRepository.save(enrollment);
        }

        return new AnswerResult(correct, correctIndex, question.getExplanation(), answered, total);
    }

    @Transactional
    public AttemptResult finish(Long attemptId, User learner) {
        QuizAttempt attempt = requireOpenAttempt(attemptId, learner);
        Module module = attempt.getModule();

        List<AttemptAnswer> answers = answerRepository.findByAttemptId(attemptId);
        int correct = (int) answers.stream().filter(AttemptAnswer::isCorrect).count();
        int total = Math.max(1, attempt.getTotalQuestions());

        BigDecimal percentage = BigDecimal.valueOf(correct * 100L)
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
        boolean passed = percentage.compareTo(BigDecimal.valueOf(module.getPassingScore())) >= 0;

        attempt.setCorrectAnswers(correct);
        attempt.setScore(correct);
        attempt.setPercentage(percentage);
        attempt.setPassed(passed);
        attempt.setCompletedAt(LocalDateTime.now());
        attemptRepository.save(attempt);

        ModuleEnrollment enrollment = enrollmentFor(learner, module);
        if (passed && !enrollment.isCompleted()) {
            enrollment.setCompleted(true);
            enrollment.setCompletedAt(attempt.getCompletedAt());
            enrollment.setProgressPercentage(100);
        } else if (!enrollment.isCompleted()) {
            enrollment.setProgressPercentage(Math.min(99, Math.round(answers.size() * 100f / total)));
        }
        enrollmentRepository.save(enrollment);

        return toResult(attempt);
    }

    /** "Restart" button: clears completion so the learner can work through the module again. */
    @Transactional
    public void restart(Long moduleId, User learner) {
        enrollmentRepository.findByUserIdAndModuleId(learner.getId(), moduleId).ifPresent(enrollment -> {
            enrollment.setCompleted(false);
            enrollment.setCompletedAt(null);
            enrollment.setProgressPercentage(0);
            enrollmentRepository.save(enrollment);
        });
    }

    @Transactional(readOnly = true)
    public List<AttemptResult> history(User learner) {
        return attemptRepository.findByUserIdOrderByStartedAtDesc(learner.getId()).stream()
                .filter(attempt -> attempt.getCompletedAt() != null)
                .map(QuizService::toResult)
                .toList();
    }

    private Module requirePublished(Long moduleId) {
        return moduleRepository.findById(moduleId)
                .filter(Module::isPublished)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found."));
    }

    private QuizAttempt requireOpenAttempt(Long attemptId, User learner) {
        QuizAttempt attempt = attemptRepository.findById(attemptId)
                .filter(a -> a.getUser().getId().equals(learner.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz attempt not found."));

        if (attempt.getCompletedAt() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This quiz attempt has already been submitted.");
        }
        if (!attempt.getModule().isPublished()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found.");
        }
        return attempt;
    }

    private ModuleEnrollment enrollmentFor(User learner, Module module) {
        return enrollmentRepository.findByUserIdAndModuleId(learner.getId(), module.getId())
                .orElseGet(() -> {
                    ModuleEnrollment enrollment = new ModuleEnrollment();
                    enrollment.setUser(learner);
                    enrollment.setModule(module);
                    enrollment.setEnrolledAt(LocalDateTime.now());
                    return enrollmentRepository.save(enrollment);
                });
    }

    private static AttemptResult toResult(QuizAttempt attempt) {
        Module module = attempt.getModule();
        return new AttemptResult(
                attempt.getId(),
                module.getId(),
                module.getTitle(),
                attempt.getPercentage().setScale(0, RoundingMode.HALF_UP).intValue(),
                attempt.getCorrectAnswers(),
                attempt.getTotalQuestions(),
                module.getPassingScore(),
                attempt.isPassed(),
                Dates.text(attempt.getStartedAt()),
                Dates.text(attempt.getCompletedAt()));
    }
}
