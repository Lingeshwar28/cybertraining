package com.cybersecurity.cybertraining;

import com.cybersecurity.cybertraining.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests with app.security.require-2fa=true (the normal setting):
 * every account must set up an authenticator app before it can sign in.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "app.security.require-2fa=true",
                // its own in-memory database, separate from the other test class
                "spring.datasource.url=jdbc:h2:mem:cybertest2fa;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"
        })
@ActiveProfiles("test")
class MandatoryTwoFactorTests {

    @Autowired
    private Environment environment;

    @Autowired
    private UserRepository userRepository;

    private TestBrowser newBrowser() {
        return new TestBrowser(environment.getProperty("local.server.port"));
    }

    /** Signs in, completing 2FA setup or the 2FA code step as needed. Returns the secret used. */
    private String signIn(TestBrowser browser, String email, String password, String knownSecret) throws Exception {
        TestBrowser.Res step1 = browser.login(email, password);
        assertEquals(200, step1.status(), step1.body());

        String secret = knownSecret;
        if (step1.body().contains("\"requiresTwoFactorSetup\":true")) {
            secret = TestBrowser.text(step1.body(), "secret");
            assertTrue(step1.body().contains("data:image/png;base64,"), "QR code expected");
        } else {
            assertTrue(step1.body().contains("\"requiresTwoFactor\":true"), step1.body());
        }

        TestBrowser.Res step2 = browser.post("/api/auth/verify-2fa", "{\"code\":\"" + TestBrowser.totp(secret) + "\"}");
        assertEquals(200, step2.status(), step2.body());
        return secret;
    }

    @Test
    void everyAccountMustSetUpTwoFactorBeforeSigningIn() throws Exception {
        // First sign-in of the admin: password alone is not enough, setup is required
        TestBrowser first = newBrowser();
        TestBrowser.Res step1 = first.login("admin@test.local", "AdminPass123");
        assertTrue(step1.body().contains("\"requiresTwoFactorSetup\":true"), step1.body());
        assertFalse(step1.body().contains("\"authenticated\":true"));
        assertEquals(401, first.get("/admin/api/users").status(), "not signed in before setup is finished");

        // Wrong code does not finish setup
        assertEquals(401, first.post("/api/auth/verify-2fa", "{\"code\":\"000000\"}").status());
        assertFalse(userRepository.findByEmail("admin@test.local").orElseThrow().isTwoFactorEnabled());

        // Correct code turns 2FA on and signs in
        String adminSecret = TestBrowser.text(step1.body(), "secret");
        TestBrowser.Res done = first.post("/api/auth/verify-2fa", "{\"code\":\"" + TestBrowser.totp(adminSecret) + "\"}");
        assertEquals(200, done.status(), done.body());
        assertTrue(userRepository.findByEmail("admin@test.local").orElseThrow().isTwoFactorEnabled());
        assertEquals(200, first.get("/admin/api/users").status());

        // Next sign-in asks for the code (no new QR code)
        TestBrowser second = newBrowser();
        TestBrowser.Res again = second.login("admin@test.local", "AdminPass123");
        assertTrue(again.body().contains("\"requiresTwoFactor\":true"), again.body());
        assertFalse(again.body().contains("secret"), "the secret must not be shown again");

        // 2FA cannot be switched off while it is required
        TestBrowser.Res off = first.post("/api/me/2fa/disable", "{\"code\":\"" + TestBrowser.totp(adminSecret) + "\"}");
        assertEquals(403, off.status(), off.body());
        assertTrue(first.get("/api/me/profile").body().contains("\"twoFactorRequired\":true"));

        // A learner created by the admin also has to set it up
        first.post("/admin/api/users",
                "{\"fullName\":\"Lucy Learner\",\"email\":\"lucy@test.local\",\"password\":\"Learner123\",\"role\":\"USER\"}");
        TestBrowser lucy = newBrowser();
        String lucySecret = signIn(lucy, "lucy@test.local", "Learner123", null);
        assertEquals(200, lucy.get("/api/learner/modules").status());

        // Lost phone: admin resets Lucy's 2FA -> she gets a NEW QR code at next sign-in
        long lucyId = userRepository.findByEmail("lucy@test.local").orElseThrow().getId();
        assertEquals(200, first.post("/admin/api/users/" + lucyId + "/reset-2fa", "{}").status());
        assertFalse(userRepository.findById(lucyId).orElseThrow().isTwoFactorEnabled());
        TestBrowser lucyAgain = newBrowser();
        TestBrowser.Res lucyStep1 = lucyAgain.login("lucy@test.local", "Learner123");
        assertTrue(lucyStep1.body().contains("\"requiresTwoFactorSetup\":true"), lucyStep1.body());
        assertNotEquals(lucySecret, TestBrowser.text(lucyStep1.body(), "secret"));

        // Admin cannot reset their own 2FA
        long adminId = userRepository.findByEmail("admin@test.local").orElseThrow().getId();
        assertEquals(403, first.post("/admin/api/users/" + adminId + "/reset-2fa", "{}").status());
    }
}