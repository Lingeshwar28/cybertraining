package com.cybersecurity.cybertraining.security;

import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Looks up the database User for the person who is signed in.
 * Also re-checks that the account is still enabled and approved,
 * so a disabled account loses access on its next request.
 */
@Component
public class CurrentUser {

    private final UserRepository userRepository;

    public CurrentUser(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User require(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in.");
        }

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Please sign in."));

        if (!user.isEnabled() || !"APPROVED".equalsIgnoreCase(user.getApprovalStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "This account is no longer permitted to sign in.");
        }

        return user;
    }
}
