package com.cybersecurity.cybertraining.service;

import com.cybersecurity.cybertraining.dto.Responses.PasswordResetView;
import com.cybersecurity.cybertraining.model.PasswordResetRequest;
import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.PasswordResetRequestRepository;
import com.cybersecurity.cybertraining.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Forgot-password flow with administrator approval.
 *
 * 1. The user submits their email + a new password.
 * 2. The new password is BCrypt-hashed and stored as a PENDING request.
 *    The current password keeps working.
 * 3. An admin approves (the hash becomes the real password) or rejects
 *    (the hash is discarded). Requests expire after 7 days.
 */
@Service
public class PasswordResetService {

    public static final int EXPIRY_DAYS = 7;

    private final PasswordResetRequestRepository resetRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public PasswordResetService(
            PasswordResetRequestRepository resetRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AuditService auditService) {

        this.resetRepository = resetRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    /**
     * Creates a pending request if the email belongs to an approved account.
     * Does nothing (silently) otherwise, so the caller cannot learn which emails exist.
     */
    @Transactional
    public void submit(String email, String newPassword, String ip) {
        UserService.validatePassword(newPassword);
        String normalisedEmail = UserService.normaliseEmail(email);
        UserService.validateEmail(normalisedEmail);

        User user = userRepository.findByEmail(normalisedEmail).orElse(null);
        if (user == null || !"APPROVED".equalsIgnoreCase(user.getApprovalStatus())) {
            return;
        }

        // Only one pending request per user: older ones are replaced.
        for (PasswordResetRequest old : resetRepository.findByUserIdAndStatus(
                user.getId(), PasswordResetRequest.PENDING)) {
            old.setStatus(PasswordResetRequest.REJECTED);
            old.setProposedPasswordHash(null);
            old.setReviewedAt(LocalDateTime.now());
        }

        PasswordResetRequest request = new PasswordResetRequest();
        request.setUser(user);
        request.setProposedPasswordHash(passwordEncoder.encode(newPassword));
        request.setStatus(PasswordResetRequest.PENDING);
        request.setRequestIp(ip);
        resetRepository.save(request);

        auditService.record(user, "PASSWORD_RESET_REQUESTED", "PasswordResetRequest",
                request.getId(), "Password reset requested; awaiting admin review");
    }

    @Transactional
    public List<PasswordResetView> listAll() {
        List<PasswordResetRequest> all = resetRepository.findAllByOrderByRequestedAtDesc();
        LocalDateTime cutoff = LocalDateTime.now().minusDays(EXPIRY_DAYS);

        for (PasswordResetRequest request : all) {
            if (PasswordResetRequest.PENDING.equals(request.getStatus())
                    && request.getRequestedAt().isBefore(cutoff)) {
                request.setStatus(PasswordResetRequest.EXPIRED);
                request.setProposedPasswordHash(null);
            }
        }

        return all.stream().map(PasswordResetService::toView).toList();
    }

    @Transactional
    public PasswordResetView approve(Long requestId, User admin) {
        PasswordResetRequest request = requirePending(requestId);
        User user = request.getUser();

        user.setPassword(request.getProposedPasswordHash());
        userRepository.save(user);

        request.setStatus(PasswordResetRequest.APPROVED);
        request.setProposedPasswordHash(null);
        request.setReviewedAt(LocalDateTime.now());
        request.setReviewedBy(admin);

        auditService.record(admin, "PASSWORD_RESET_APPROVED", "User", user.getId(),
                "Approved password reset for " + user.getEmail());
        return toView(request);
    }

    @Transactional
    public PasswordResetView reject(Long requestId, User admin) {
        PasswordResetRequest request = requirePending(requestId);

        request.setStatus(PasswordResetRequest.REJECTED);
        request.setProposedPasswordHash(null);
        request.setReviewedAt(LocalDateTime.now());
        request.setReviewedBy(admin);

        auditService.record(admin, "PASSWORD_RESET_REJECTED", "User", request.getUser().getId(),
                "Rejected password reset for " + request.getUser().getEmail());
        return toView(request);
    }

    private PasswordResetRequest requirePending(Long requestId) {
        PasswordResetRequest request = resetRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Password reset request not found."));

        if (!PasswordResetRequest.PENDING.equals(request.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This request has already been " + request.getStatus().toLowerCase() + ".");
        }

        if (request.getRequestedAt().isBefore(LocalDateTime.now().minusDays(EXPIRY_DAYS))) {
            request.setStatus(PasswordResetRequest.EXPIRED);
            request.setProposedPasswordHash(null);
            resetRepository.save(request);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This request is older than " + EXPIRY_DAYS + " days and has expired.");
        }

        return request;
    }

    private static PasswordResetView toView(PasswordResetRequest request) {
        User user = request.getUser();
        User reviewer = request.getReviewedBy();
        return new PasswordResetView(
                request.getId(),
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                request.getStatus(),
                Dates.text(request.getRequestedAt()),
                Dates.text(request.getReviewedAt()),
                reviewer == null ? null : reviewer.getFullName());
    }
}
