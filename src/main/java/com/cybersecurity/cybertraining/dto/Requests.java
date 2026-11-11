package com.cybersecurity.cybertraining.dto;

import java.util.List;

/**
 * JSON bodies that the front end (index.html) sends to the backend.
 * Each record is one request type. Validation happens in the services.
 */
public final class Requests {

    private Requests() {
    }

    public record LoginRequest(String email, String password) {
    }

    public record TwoFactorCodeRequest(String code) {
    }

    public record RegisterRequest(String fullName, String email, String phone, String password) {
    }

    public record ForgotPasswordRequest(String email, String newPassword) {
    }

    public record ProfileUpdateRequest(String fullName, String phone, String photo) {
    }

    public record CreateUserRequest(String fullName, String email, String password, String role) {
    }

    public record RoleRequest(String role) {
    }

    public record StatusRequest(Boolean enabled) {
    }

    public record PublishRequest(Boolean published) {
    }

    public record AnswerRequest(Long questionId, Integer answer) {
    }

    public record CertTemplateRequest(String title, String subtitle, String badge, String accentColor) {
    }

    public record ModuleRequest(
            String title,
            String desc,
            String content,
            String category,
            Integer duration,
            String dueDate,
            String thumbnail,
            String color,
            String videoUrl,
            String videoName,
            Integer passingScore,
            Boolean published,
            CertTemplateRequest certTemplate
    ) {
    }

    /** id is null for a brand-new question, or the database id of an existing one. */
    public record QuestionRequest(
            Long id,
            String q,
            List<String> options,
            Integer answer,
            String hint,
            String explanation
    ) {
    }
}
