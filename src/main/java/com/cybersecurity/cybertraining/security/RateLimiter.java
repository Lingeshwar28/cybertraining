package com.cybersecurity.cybertraining.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Very small in-memory rate limiter used to slow down brute-force attempts
 * on login, 2FA, registration and forgot-password.
 *
 * Example: tryAcquire("login:1.2.3.4", 10, Duration.ofMinutes(5))
 * allows 10 attempts per 5 minutes for that key.
 */
@Component
public class RateLimiter {

    private static final int MAX_KEYS = 10_000;

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final boolean enabled;

    public RateLimiter(@Value("${app.rate-limit.enabled:true}") boolean enabled) {
        this.enabled = enabled;
    }

    public boolean tryAcquire(String key, int maxAttempts, Duration period) {
        if (!enabled) {
            return true;
        }
        Instant now = Instant.now();

        if (windows.size() > MAX_KEYS) {
            windows.entrySet().removeIf(entry -> entry.getValue().resetAt.isBefore(now));
        }

        Window window = windows.compute(key, (k, existing) -> {
            if (existing == null || existing.resetAt.isBefore(now)) {
                return new Window(now.plus(period));
            }
            return existing;
        });

        synchronized (window) {
            window.count++;
            return window.count <= maxAttempts;
        }
    }

    private static final class Window {
        private final Instant resetAt;
        private int count;

        private Window(Instant resetAt) {
            this.resetAt = resetAt;
        }
    }
}
