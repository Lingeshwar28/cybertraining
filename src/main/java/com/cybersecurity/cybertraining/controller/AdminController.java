package com.cybersecurity.cybertraining.controller;

import com.cybersecurity.cybertraining.dto.Requests.CreateUserRequest;
import com.cybersecurity.cybertraining.dto.Requests.RoleRequest;
import com.cybersecurity.cybertraining.dto.Requests.StatusRequest;
import com.cybersecurity.cybertraining.dto.Responses.AdminUserResponse;
import com.cybersecurity.cybertraining.dto.Responses.AuditLogView;
import com.cybersecurity.cybertraining.dto.Responses.ModuleView;
import com.cybersecurity.cybertraining.dto.Responses.PasswordResetView;
import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.UserRepository;
import com.cybersecurity.cybertraining.security.CurrentUser;
import com.cybersecurity.cybertraining.service.AuditService;
import com.cybersecurity.cybertraining.service.ModuleService;
import com.cybersecurity.cybertraining.service.PasswordResetService;
import com.cybersecurity.cybertraining.service.TwoFactorService;
import com.cybersecurity.cybertraining.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Administrator endpoints (ADMIN role only - enforced in SecurityConfig).
 *
 *  GET  /admin/api/users                         all accounts (no passwords / 2FA secrets)
 *  POST /admin/api/users                         create an approved USER or MODULE_OWNER
 *  POST /admin/api/users/{id}/approve            approve a pending registration
 *  POST /admin/api/users/{id}/reject             reject a pending registration
 *  PUT  /admin/api/users/{id}/role               USER <-> MODULE_OWNER
 *  PUT  /admin/api/users/{id}/status             enable / disable
 *  POST /admin/api/users/{id}/reset-2fa          clear 2FA (lost phone) -> set up again at next sign-in
 *  GET  /admin/api/modules                       all modules with completion stats
 *  GET  /admin/api/password-resets               password reset requests
 *  POST /admin/api/password-resets/{id}/approve
 *  POST /admin/api/password-resets/{id}/reject
 *  GET  /admin/api/audit-logs                    latest 200 audit entries
 */
@RestController
@RequestMapping("/admin/api")
public class AdminController {

    private static final Set<String> ASSIGNABLE_ROLES =
            Set.of(UserService.ROLE_USER, UserService.ROLE_MODULE_OWNER);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUser currentUser;
    private final ModuleService moduleService;
    private final PasswordResetService passwordResetService;
    private final AuditService auditService;
    private final TwoFactorService twoFactorService;

    public AdminController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            CurrentUser currentUser,
            ModuleService moduleService,
            PasswordResetService passwordResetService,
            AuditService auditService,
            TwoFactorService twoFactorService) {

        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.currentUser = currentUser;
        this.moduleService = moduleService;
        this.passwordResetService = passwordResetService;
        this.auditService = auditService;
        this.twoFactorService = twoFactorService;
    }

    // ------------------------------------------------------------- users

    @GetMapping("/users")
    public List<AdminUserResponse> users(Authentication authentication) {
        currentUser.require(authentication);
        return userRepository.findAll().stream()
                .sorted(Comparator.comparing(User::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(UserService::toAdminView)
                .toList();
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AdminUserResponse createUser(@RequestBody CreateUserRequest request, Authentication authentication) {
        User admin = currentUser.require(authentication);
        if (request == null) {
            throw new IllegalArgumentException("Account details are missing.");
        }

        String name = UserService.validateName(request.fullName());
        String email = UserService.normaliseEmail(request.email());
        UserService.validateEmail(email);
        UserService.validatePassword(request.password());

        String role = request.role() == null ? UserService.ROLE_USER
                : request.role().trim().toUpperCase(Locale.ROOT);
        if (!ASSIGNABLE_ROLES.contains(role)) {
            throw new IllegalArgumentException("New accounts can only be USER or MODULE_OWNER.");
        }

        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists.");
        }

        User user = new User();
        user.setFullName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(role);
        user.setEnabled(true);
        user.setApprovalStatus("APPROVED");
        user.setTwoFactorEnabled(false);

        User saved = userRepository.save(user);
        auditService.record(admin, "USER_CREATED", "User", saved.getId(), "Created " + role + " " + email);
        return UserService.toAdminView(saved);
    }

    @PostMapping("/users/{id}/approve")
    @Transactional
    public AdminUserResponse approve(@PathVariable Long id, Authentication authentication) {
        User admin = currentUser.require(authentication);
        User user = requirePending(id);

        user.setApprovalStatus("APPROVED");
        user.setEnabled(true);
        userRepository.save(user);

        auditService.record(admin, "REGISTRATION_APPROVED", "User", id, "Approved " + user.getEmail());
        return UserService.toAdminView(user);
    }

    @PostMapping("/users/{id}/reject")
    @Transactional
    public AdminUserResponse reject(@PathVariable Long id, Authentication authentication) {
        User admin = currentUser.require(authentication);
        User user = requirePending(id);

        user.setApprovalStatus("REJECTED");
        user.setEnabled(false);
        userRepository.save(user);

        auditService.record(admin, "REGISTRATION_REJECTED", "User", id, "Rejected " + user.getEmail());
        return UserService.toAdminView(user);
    }

    @PutMapping("/users/{id}/role")
    @Transactional
    public AdminUserResponse changeRole(
            @PathVariable Long id,
            @RequestBody RoleRequest request,
            Authentication authentication) {

        User admin = currentUser.require(authentication);
        User user = requireUser(id);

        String role = request == null || request.role() == null ? ""
                : request.role().trim().toUpperCase(Locale.ROOT);

        if (!ASSIGNABLE_ROLES.contains(role)) {
            throw new IllegalArgumentException("Role must be USER or MODULE_OWNER.");
        }
        if (UserService.ROLE_ADMIN.equals(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator roles cannot be changed here.");
        }

        String oldRole = user.getRole();
        user.setRole(role);
        userRepository.save(user);

        auditService.record(admin, "ROLE_CHANGED", "User", id,
                user.getEmail() + ": " + oldRole + " -> " + role);
        return UserService.toAdminView(user);
    }

    @PutMapping("/users/{id}/status")
    @Transactional
    public AdminUserResponse changeStatus(
            @PathVariable Long id,
            @RequestBody StatusRequest request,
            Authentication authentication) {

        User admin = currentUser.require(authentication);
        User user = requireUser(id);

        if (request == null || request.enabled() == null) {
            throw new IllegalArgumentException("Say whether the account should be enabled.");
        }
        if (user.getId().equals(admin.getId()) && !request.enabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot disable your own administrator account.");
        }
        if (UserService.ROLE_ADMIN.equals(user.getRole()) && !request.enabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator accounts cannot be disabled here.");
        }
        if (request.enabled() && !"APPROVED".equalsIgnoreCase(user.getApprovalStatus())) {
            throw new IllegalArgumentException("Approve this registration before enabling the account.");
        }

        user.setEnabled(request.enabled());
        userRepository.save(user);

        auditService.record(admin, request.enabled() ? "ACCOUNT_ENABLED" : "ACCOUNT_DISABLED",
                "User", id, user.getEmail());
        return UserService.toAdminView(user);
    }

    /** For a user who lost their phone: removes their 2FA so they set it up again at next sign-in. */
    @PostMapping("/users/{id}/reset-2fa")
    @Transactional
    public AdminUserResponse resetTwoFactor(@PathVariable Long id, Authentication authentication) {
        User admin = currentUser.require(authentication);
        User user = requireUser(id);

        if (user.getId().equals(admin.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You cannot reset your own 2FA here. Ask another administrator.");
        }

        twoFactorService.disableTwoFactor(user);
        auditService.record(admin, "2FA_RESET", "User", id, "Reset two-factor authentication for " + user.getEmail());
        return UserService.toAdminView(user);
    }

    // ------------------------------------------------------------- modules

    @GetMapping("/modules")
    public List<ModuleView> modules(Authentication authentication) {
        currentUser.require(authentication);
        return moduleService.allModulesWithStats();
    }

    // ------------------------------------------------------------- password resets

    @GetMapping("/password-resets")
    public List<PasswordResetView> passwordResets(Authentication authentication) {
        currentUser.require(authentication);
        return passwordResetService.listAll();
    }

    @PostMapping("/password-resets/{id}/approve")
    public PasswordResetView approveReset(@PathVariable Long id, Authentication authentication) {
        return passwordResetService.approve(id, currentUser.require(authentication));
    }

    @PostMapping("/password-resets/{id}/reject")
    public PasswordResetView rejectReset(@PathVariable Long id, Authentication authentication) {
        return passwordResetService.reject(id, currentUser.require(authentication));
    }

    // ------------------------------------------------------------- audit log

    @GetMapping("/audit-logs")
    public List<AuditLogView> auditLogs(Authentication authentication) {
        currentUser.require(authentication);
        return auditService.latest();
    }

    // ------------------------------------------------------------- helpers

    private User requireUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
    }

    private User requirePending(Long id) {
        User user = requireUser(id);
        if (!"PENDING".equalsIgnoreCase(user.getApprovalStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This registration is no longer pending.");
        }
        return user;
    }
}