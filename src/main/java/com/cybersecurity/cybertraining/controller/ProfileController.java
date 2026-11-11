package com.cybersecurity.cybertraining.controller;

import com.cybersecurity.cybertraining.dto.Requests.ProfileUpdateRequest;
import com.cybersecurity.cybertraining.dto.Requests.TwoFactorCodeRequest;
import com.cybersecurity.cybertraining.dto.Responses.ProfileResponse;
import com.cybersecurity.cybertraining.dto.Responses.TwoFactorSetupResponse;
import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.UserRepository;
import com.cybersecurity.cybertraining.security.CurrentUser;
import com.cybersecurity.cybertraining.service.AuditService;
import com.cybersecurity.cybertraining.service.TwoFactorService;
import com.cybersecurity.cybertraining.service.UserService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.regex.Pattern;

/**
 * The signed-in user's own account (any role).
 *
 *  GET  /api/me/profile         profile details
 *  PUT  /api/me/profile         update name, phone and photo
 *  POST /api/me/2fa/setup       start 2FA setup -> QR code
 *  POST /api/me/2fa/enable      confirm with a code from the authenticator app
 *  POST /api/me/2fa/disable     turn 2FA off (needs a current code)
 */
@RestController
@RequestMapping("/api/me")
public class ProfileController {

    private static final String SETUP_SECRET = "TWO_FACTOR_SETUP_SECRET";

    // Small images only (about 1 MB once encoded).
    private static final int MAX_PHOTO_LENGTH = 1_400_000;
    private static final Pattern PHOTO_DATA_URL =
            Pattern.compile("^data:image/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$");

    private final CurrentUser currentUser;
    private final UserRepository userRepository;
    private final UserService userService;
    private final TwoFactorService twoFactorService;
    private final AuditService auditService;

    public ProfileController(
            CurrentUser currentUser,
            UserRepository userRepository,
            UserService userService,
            TwoFactorService twoFactorService,
            AuditService auditService) {

        this.currentUser = currentUser;
        this.userRepository = userRepository;
        this.userService = userService;
        this.twoFactorService = twoFactorService;
        this.auditService = auditService;
    }

    @GetMapping("/profile")
    public ProfileResponse profile(Authentication authentication) {
        return userService.toProfile(currentUser.require(authentication));
    }

    @PutMapping("/profile")
    public ProfileResponse updateProfile(
            @RequestBody ProfileUpdateRequest request,
            Authentication authentication) {

        User user = currentUser.require(authentication);
        if (request == null) {
            throw new IllegalArgumentException("Profile details are missing.");
        }

        user.setFullName(UserService.validateName(request.fullName()));
        user.setPhone(UserService.validatePhone(request.phone()));

        String photo = request.photo() == null ? "" : request.photo().trim();
        if (photo.isEmpty()) {
            user.setPhoto(null);
        } else {
            if (photo.length() > MAX_PHOTO_LENGTH || !PHOTO_DATA_URL.matcher(photo).matches()) {
                throw new IllegalArgumentException("Profile photo must be a PNG, JPG, GIF or WebP image under 1 MB.");
            }
            user.setPhoto(photo);
        }

        userRepository.save(user);
        auditService.record(user, "PROFILE_UPDATED", "User", user.getId(), "Updated own profile");
        return userService.toProfile(user);
    }

    @PostMapping("/2fa/setup")
    public TwoFactorSetupResponse startTwoFactorSetup(Authentication authentication, HttpSession session) {
        User user = currentUser.require(authentication);

        if (user.isTwoFactorEnabled()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Two-factor authentication is already enabled.");
        }

        // The secret stays in the server session until the user proves the app works.
        String secret = twoFactorService.generateSecret();
        session.setAttribute(SETUP_SECRET, secret);

        try {
            return new TwoFactorSetupResponse(twoFactorService.generateQrCode(user.getEmail(), secret), secret);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to generate the QR code.");
        }
    }

    @PostMapping("/2fa/enable")
    public ProfileResponse enableTwoFactor(
            @RequestBody TwoFactorCodeRequest request,
            Authentication authentication,
            HttpSession session) {

        User user = currentUser.require(authentication);
        Object secret = session.getAttribute(SETUP_SECRET);

        if (!(secret instanceof String pendingSecret)) {
            throw new IllegalArgumentException("Start the 2FA setup again to get a new QR code.");
        }

        if (request == null || !twoFactorService.verifyCode(pendingSecret, request.code())) {
            throw new IllegalArgumentException("That code is not correct. Enter the current 6-digit code from your app.");
        }

        twoFactorService.enableTwoFactor(user, pendingSecret);
        session.removeAttribute(SETUP_SECRET);
        auditService.record(user, "2FA_ENABLED", "User", user.getId(), "Enabled two-factor authentication");
        return userService.toProfile(user);
    }

    @PostMapping("/2fa/disable")
    public ProfileResponse disableTwoFactor(
            @RequestBody TwoFactorCodeRequest request,
            Authentication authentication) {

        User user = currentUser.require(authentication);

        if (!user.isTwoFactorEnabled()) {
            return userService.toProfile(user);
        }

        if (twoFactorService.isRequired()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Two-factor authentication is required for every account and cannot be turned off.");
        }

        if (request == null || !twoFactorService.verifyCode(user.getTwoFactorSecret(), request.code())) {
            throw new IllegalArgumentException("Enter the current 6-digit code from your authenticator app to turn 2FA off.");
        }

        twoFactorService.disableTwoFactor(user);
        auditService.record(user, "2FA_DISABLED", "User", user.getId(), "Disabled two-factor authentication");
        return userService.toProfile(user);
    }
}
