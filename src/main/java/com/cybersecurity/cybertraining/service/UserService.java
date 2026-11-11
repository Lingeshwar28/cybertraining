package com.cybersecurity.cybertraining.service;

import com.cybersecurity.cybertraining.dto.Responses.AdminUserResponse;
import com.cybersecurity.cybertraining.dto.Responses.ProfileResponse;
import com.cybersecurity.cybertraining.dto.Responses.SessionUser;
import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Account rules: registration, validation and converting users to safe JSON.
 */
@Service
public class UserService {

    public static final String ROLE_USER = "USER";
    public static final String ROLE_MODULE_OWNER = "MODULE_OWNER";
    public static final String ROLE_ADMIN = "ADMIN";

    private static final Pattern EMAIL =
            Pattern.compile("^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private static final Pattern PHONE = Pattern.compile("^[0-9+()\\-\\s]{0,30}$");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final TwoFactorService twoFactorService;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AuditService auditService,
            TwoFactorService twoFactorService) {

        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.twoFactorService = twoFactorService;
    }

    // ---------- validation helpers ----------

    public static String normaliseEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    public static void validateEmail(String email) {
        if (email.isEmpty() || email.length() > 255 || !EMAIL.matcher(email).matches()) {
            throw new IllegalArgumentException("Enter a valid email address.");
        }
    }

    public static String validateName(String fullName) {
        String name = fullName == null ? "" : fullName.trim();
        if (name.length() < 2 || name.length() > 100) {
            throw new IllegalArgumentException("Full name must be between 2 and 100 characters.");
        }
        return name;
    }

    public static String validatePhone(String phone) {
        String value = phone == null ? "" : phone.trim();
        if (!PHONE.matcher(value).matches()) {
            throw new IllegalArgumentException("Phone number can only contain digits, spaces, +, - and brackets.");
        }
        return value.isEmpty() ? null : value;
    }

    /** At least 8 characters, at most 72 (BCrypt limit), with a letter and a number. */
    public static void validatePassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 72
                || !password.matches(".*[A-Za-z].*") || !password.matches(".*[0-9].*")) {
            throw new IllegalArgumentException(
                    "Password must be 8-72 characters and include at least one letter and one number.");
        }
    }

    // ---------- registration ----------

    /**
     * Registers a new learner with PENDING approval.
     * Returns empty (and creates nothing) when the email is already registered,
     * so the public response does not reveal which emails exist.
     */
    @Transactional
    public Optional<User> registerUser(String fullName, String email, String phone, String password) {
        String name = validateName(fullName);
        String normalisedEmail = normaliseEmail(email);
        validateEmail(normalisedEmail);
        String cleanPhone = validatePhone(phone);
        validatePassword(password);

        if (userRepository.existsByEmail(normalisedEmail)) {
            return Optional.empty();
        }

        User user = new User();
        user.setFullName(name);
        user.setEmail(normalisedEmail);
        user.setPhone(cleanPhone);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(ROLE_USER);
        user.setEnabled(true);
        user.setApprovalStatus("PENDING");
        user.setTwoFactorEnabled(false);

        User saved = userRepository.save(user);
        auditService.record(saved, "REGISTER", "User", saved.getId(), "New registration awaiting approval");
        return Optional.of(saved);
    }

    // ---------- JSON views ----------

    public SessionUser toSessionUser(User user) {
        return new SessionUser(user.getId(), user.getFullName(), user.getEmail(),
                user.getRole(), user.isTwoFactorEnabled());
    }

    public ProfileResponse toProfile(User user) {
        return new ProfileResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getPhoto(),
                user.getRole(),
                user.getCreatedAt() == null ? null : user.getCreatedAt().toLocalDate().toString(),
                user.isTwoFactorEnabled(),
                twoFactorService.isRequired());
    }

    public static AdminUserResponse toAdminView(User user) {
        return new AdminUserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole(),
                user.isEnabled(),
                user.getApprovalStatus(),
                user.isTwoFactorEnabled(),
                Dates.text(user.getCreatedAt()));
    }
}
