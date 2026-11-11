package com.cybersecurity.cybertraining.controller;

import com.cybersecurity.cybertraining.dto.Requests.ForgotPasswordRequest;
import com.cybersecurity.cybertraining.dto.Requests.LoginRequest;
import com.cybersecurity.cybertraining.dto.Requests.RegisterRequest;
import com.cybersecurity.cybertraining.dto.Requests.TwoFactorCodeRequest;
import com.cybersecurity.cybertraining.dto.Responses.CsrfResponse;
import com.cybersecurity.cybertraining.dto.Responses.MessageResponse;
import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.UserRepository;
import com.cybersecurity.cybertraining.security.ClientIp;
import com.cybersecurity.cybertraining.security.RateLimiter;
import com.cybersecurity.cybertraining.service.AuditService;
import com.cybersecurity.cybertraining.service.PasswordResetService;
import com.cybersecurity.cybertraining.service.TwoFactorService;
import com.cybersecurity.cybertraining.service.UserService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Public sign-in endpoints used by index.html.
 *
 *  GET  /api/auth/csrf             security token for POST requests
 *  GET  /api/auth/me               who is signed in (used after a page refresh)
 *  POST /api/auth/login            email + password (step 1)
 *  POST /api/auth/verify-2fa       authenticator code (step 2). If the account has no
 *                                  2FA yet and 2FA is required, step 1 returns a QR code
 *                                  and this call also switches 2FA on.
 *  POST /api/auth/register         new account -> PENDING until an admin approves
 *  POST /api/auth/forgot-password  creates a reset request for an admin to review
 *  POST /api/auth/logout           ends the session
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String PENDING_EMAIL = "TWO_FACTOR_PENDING_EMAIL";
    private static final String PENDING_AUTHENTICATION = "TWO_FACTOR_PENDING_AUTHENTICATION";
    // Secret for an account that is setting up 2FA during sign-in (2FA is mandatory).
    private static final String PENDING_SETUP_SECRET = "TWO_FACTOR_PENDING_SETUP_SECRET";

    private static final String GENERIC_LOGIN_FAILURE =
            "Sign-in failed. Check your email and password. New accounts can only sign in after an administrator approves them.";

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final UserService userService;
    private final TwoFactorService twoFactorService;
    private final PasswordResetService passwordResetService;
    private final AuditService auditService;
    private final RateLimiter rateLimiter;
    private final SecurityContextRepository securityContextRepository;

    public AuthController(
            AuthenticationManager authenticationManager,
            UserRepository userRepository,
            UserService userService,
            TwoFactorService twoFactorService,
            PasswordResetService passwordResetService,
            AuditService auditService,
            RateLimiter rateLimiter,
            SecurityContextRepository securityContextRepository) {

        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.userService = userService;
        this.twoFactorService = twoFactorService;
        this.passwordResetService = passwordResetService;
        this.auditService = auditService;
        this.rateLimiter = rateLimiter;
        this.securityContextRepository = securityContextRepository;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(HttpServletRequest request) {
        CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (token == null) {
            throw new IllegalStateException("CSRF protection is not configured.");
        }
        return new CsrfResponse(token.getHeaderName(), token.getToken());
    }

    @GetMapping("/me")
    public Map<String, Object> me(Authentication authentication) {
        Map<String, Object> body = new LinkedHashMap<>();

        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            body.put("authenticated", false);
            return body;
        }

        User user = userRepository.findByEmail(authentication.getName()).orElse(null);
        if (!isAccountAllowed(user)) {
            body.put("authenticated", false);
            return body;
        }

        body.put("authenticated", true);
        body.put("user", userService.toSessionUser(user));
        return body;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {

        HttpSession session = httpRequest.getSession();

        if (request == null || request.email() == null || request.password() == null
                || request.email().isBlank() || request.password().isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "Enter your email address and password.");
        }

        String email = UserService.normaliseEmail(request.email());

        if (!rateLimiter.tryAcquire("login:" + ClientIp.of(httpRequest), 20, Duration.ofMinutes(5))
                || !rateLimiter.tryAcquire("login-email:" + email, 8, Duration.ofMinutes(5))) {
            return error(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many sign-in attempts. Please wait a few minutes and try again.");
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password()));

            User user = userRepository.findByEmail(email).orElse(null);

            if (!isAccountAllowed(user)) {
                clearPendingLogin(session);
                SecurityContextHolder.clearContext();
                return error(HttpStatus.UNAUTHORIZED, GENERIC_LOGIN_FAILURE);
            }

            // Do not create a fully signed-in session before 2FA is checked.
            SecurityContextHolder.clearContext();
            securityContextRepository.saveContext(
                    SecurityContextHolder.createEmptyContext(), httpRequest, httpResponse);

            if (user.isTwoFactorEnabled()) {
                session.setAttribute(PENDING_EMAIL, user.getEmail());
                session.setAttribute(PENDING_AUTHENTICATION, authentication);

                Map<String, Object> body = new LinkedHashMap<>();
                body.put("requiresTwoFactor", true);
                body.put("message", "Enter the current code from your authenticator app.");
                return ResponseEntity.ok(body);
            }

            if (twoFactorService.isRequired()) {
                // 2FA is mandatory: the account must set it up before it can sign in.
                String secret = twoFactorService.generateSecret();
                session.setAttribute(PENDING_EMAIL, user.getEmail());
                session.setAttribute(PENDING_AUTHENTICATION, authentication);
                session.setAttribute(PENDING_SETUP_SECRET, secret);

                Map<String, Object> body = new LinkedHashMap<>();
                body.put("requiresTwoFactorSetup", true);
                body.put("qrCode", qrCodeFor(user.getEmail(), secret));
                body.put("secret", secret);
                body.put("message", "Two-factor authentication is required. Scan the QR code with your authenticator app, then enter the 6-digit code.");
                return ResponseEntity.ok(body);
            }

            clearPendingLogin(session);
            establishSession(authentication, httpRequest, httpResponse);
            auditService.record(user, "LOGIN_SUCCESS", "User", user.getId(), "Signed in");

            return ResponseEntity.ok(signedIn(user));

        } catch (AuthenticationException exception) {
            SecurityContextHolder.clearContext();
            clearPendingLogin(session);
            auditService.record(userRepository.findByEmail(email).orElse(null),
                    "LOGIN_FAILED", "User", null, "Failed sign-in for " + email);
            return error(HttpStatus.UNAUTHORIZED, GENERIC_LOGIN_FAILURE);
        }
    }

    @PostMapping("/verify-2fa")
    public ResponseEntity<Map<String, Object>> verifyTwoFactor(
            @RequestBody TwoFactorCodeRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {

        HttpSession session = httpRequest.getSession();
        Object pendingEmail = session.getAttribute(PENDING_EMAIL);
        Object pendingAuthentication = session.getAttribute(PENDING_AUTHENTICATION);

        if (!(pendingEmail instanceof String email)
                || email.isBlank()
                || !(pendingAuthentication instanceof Authentication authentication)
                || !authentication.isAuthenticated()) {

            clearPendingLogin(session);
            return error(HttpStatus.UNAUTHORIZED, "Your sign-in session expired. Please sign in again.");
        }

        if (!rateLimiter.tryAcquire("2fa:" + email, 6, Duration.ofMinutes(5))) {
            clearPendingLogin(session);
            return error(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many incorrect codes. Please wait a few minutes and sign in again.");
        }

        if (request == null || request.code() == null || !request.code().matches("[0-9]{6}")) {
            return error(HttpStatus.BAD_REQUEST, "Enter a valid six-digit authenticator code.");
        }

        User user = userRepository.findByEmail(email).orElse(null);
        Object setupSecret = session.getAttribute(PENDING_SETUP_SECRET);
        boolean settingUp = setupSecret instanceof String;

        if (!isAccountAllowed(user)
                || (!settingUp && !user.isTwoFactorEnabled())
                || !authentication.getName().equalsIgnoreCase(user.getEmail())) {

            clearPendingLogin(session);
            SecurityContextHolder.clearContext();
            return error(HttpStatus.UNAUTHORIZED,
                    "This account is not currently permitted to sign in. Please contact the administrator.");
        }

        String secretToCheck = settingUp ? (String) setupSecret : user.getTwoFactorSecret();

        if (!twoFactorService.verifyCode(secretToCheck, request.code())) {
            auditService.record(user, "LOGIN_2FA_FAILED", "User", user.getId(), "Incorrect authenticator code");
            return error(HttpStatus.UNAUTHORIZED,
                    "The authenticator code is invalid. Try the current six-digit code.");
        }

        if (settingUp) {
            twoFactorService.enableTwoFactor(user, (String) setupSecret);
            auditService.record(user, "2FA_ENABLED", "User", user.getId(),
                    "Set up two-factor authentication during sign-in");
        }

        clearPendingLogin(session);
        establishSession(authentication, httpRequest, httpResponse);
        auditService.record(user, "LOGIN_SUCCESS", "User", user.getId(), "Signed in with 2FA");

        return ResponseEntity.ok(signedIn(user));
    }

    @PostMapping("/register")
    public ResponseEntity<MessageResponse> register(
            @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest) {

        if (!rateLimiter.tryAcquire("register:" + ClientIp.of(httpRequest), 5, Duration.ofMinutes(15))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new MessageResponse("Too many registration attempts. Please try again later."));
        }

        if (request == null) {
            throw new IllegalArgumentException("Registration details are missing.");
        }

        // Validation problems (bad email, weak password...) are returned as 400 with a message.
        userService.registerUser(request.fullName(), request.email(), request.phone(), request.password());

        // Same answer whether or not the email was already registered.
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new MessageResponse(
                "Registration submitted. An administrator will review your request before you can sign in."));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<MessageResponse> forgotPassword(
            @RequestBody ForgotPasswordRequest request,
            HttpServletRequest httpRequest) {

        if (!rateLimiter.tryAcquire("forgot:" + ClientIp.of(httpRequest), 5, Duration.ofMinutes(15))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new MessageResponse("Too many requests. Please try again later."));
        }

        if (request == null) {
            throw new IllegalArgumentException("Enter your email address and a new password.");
        }

        passwordResetService.submit(request.email(), request.newPassword(), ClientIp.of(httpRequest));

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new MessageResponse(
                "If an approved account uses that email, a reset request has been sent to the administrator. "
                        + "Your current password keeps working until it is approved."));
    }

    @PostMapping("/logout")
    public MessageResponse logout(
            Authentication authentication,
            HttpServletRequest request,
            HttpServletResponse response) {

        if (authentication != null) {
            userRepository.findByEmail(authentication.getName()).ifPresent(user ->
                    auditService.record(user, "LOGOUT", "User", user.getId(), "Signed out"));
        }

        new SecurityContextLogoutHandler().logout(request, response, authentication);
        return new MessageResponse("Signed out.");
    }

    // ---------------------------------------------------------------------

    private Map<String, Object> signedIn(User user) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("authenticated", true);
        body.put("user", userService.toSessionUser(user));
        return body;
    }

    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }

    private static boolean isAccountAllowed(User user) {
        return user != null
                && user.isEnabled()
                && "APPROVED".equalsIgnoreCase(user.getApprovalStatus());
    }

    private static void clearPendingLogin(HttpSession session) {
        session.removeAttribute(PENDING_EMAIL);
        session.removeAttribute(PENDING_AUTHENTICATION);
        session.removeAttribute(PENDING_SETUP_SECRET);
    }

    private String qrCodeFor(String email, String secret) {
        try {
            return twoFactorService.generateQrCode(email, secret);
        } catch (Exception exception) {
            // The secret is still returned, so the user can type it into the app by hand.
            return null;
        }
    }

    private void establishSession(
            Authentication authentication,
            HttpServletRequest request,
            HttpServletResponse response) {

        // New session id after login prevents session-fixation attacks.
        request.changeSessionId();

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }
}