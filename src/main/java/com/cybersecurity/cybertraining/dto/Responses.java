package com.cybersecurity.cybertraining.dto;

import java.util.List;
import java.util.Map;

/**
 * JSON objects that the backend sends to the front end.
 * These records never contain password hashes or 2FA secrets.
 * Dates are sent as ISO text, e.g. "2026-10-31" or "2026-10-31T14:05:00".
 */
public final class Responses {

    private Responses() {
    }

    public record MessageResponse(String message) {
    }

    public record CsrfResponse(String headerName, String token) {
    }

    /** The signed-in user as the front end needs it. */
    public record SessionUser(Long id, String name, String email, String role, boolean twoFactorEnabled) {
    }

    public record ProfileResponse(
            Long id,
            String name,
            String email,
            String phone,
            String photo,
            String role,
            String joinDate,
            boolean twoFactorEnabled,
            boolean twoFactorRequired
    ) {
    }

    public record TwoFactorSetupResponse(String qrCode, String secret) {
    }

    public record AdminUserResponse(
            Long id,
            String fullName,
            String email,
            String phone,
            String role,
            boolean enabled,
            String approvalStatus,
            boolean twoFactorEnabled,
            String createdAt
    ) {
    }

    public record CertTemplate(String title, String subtitle, String badge, String accentColor) {
    }

    /** A learner's progress on one module. */
    public record Progress(
            boolean started,
            boolean completed,
            Integer score,
            String completedDate,
            int currentQ,
            int progressPercentage
    ) {
    }

    /** Completion numbers for one module across all learners. */
    public record ModuleStats(int total, int completed, int started, int pct) {
    }

    /** answer and explanation are only filled in for the module owner. */
    public record QuestionView(
            Long id,
            String q,
            List<String> options,
            Integer answer,
            String hint,
            String explanation
    ) {
    }

    /**
     * One module. Fields that do not apply to the caller are null:
     * learners get "progress" but no "quiz"; owners/admins get "quiz" and "stats".
     */
    public record ModuleView(
            Long id,
            String title,
            String desc,
            String content,
            String category,
            int duration,
            String dueDate,
            String thumbnail,
            String color,
            String videoUrl,
            String videoName,
            int passingScore,
            boolean published,
            int questionCount,
            String ownerName,
            CertTemplate certTemplate,
            List<QuestionView> quiz,
            Progress progress,
            ModuleStats stats
    ) {
    }

    public record AttemptStart(Long attemptId, Long moduleId, List<QuestionView> questions) {
    }

    public record AnswerResult(boolean correct, int correctAnswer, String explanation, int answered, int total) {
    }

    public record AttemptResult(
            Long attemptId,
            Long moduleId,
            String moduleTitle,
            int score,
            int correctAnswers,
            int totalQuestions,
            int passingScore,
            boolean passed,
            String startedAt,
            String completedAt
    ) {
    }

    /** One learner and their progress on each module (keyed by module id). */
    public record LearnerProgress(
            Long id,
            String name,
            String email,
            Map<Long, Progress> progress
    ) {
    }

    public record PasswordResetView(
            Long id,
            Long userId,
            String userName,
            String email,
            String status,
            String requestedAt,
            String reviewedAt,
            String reviewedBy
    ) {
    }

    public record AuditLogView(
            Long id,
            String actor,
            String action,
            String entityType,
            Long entityId,
            String description,
            String ipAddress,
            String createdAt
    ) {
    }
}
