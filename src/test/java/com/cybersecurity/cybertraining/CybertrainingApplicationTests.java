package com.cybersecurity.cybertraining;

import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.ModuleEnrollmentRepository;
import com.cybersecurity.cybertraining.repository.ModuleRepository;
import com.cybersecurity.cybertraining.repository.QuizAttemptRepository;
import com.cybersecurity.cybertraining.repository.UserRepository;
import com.cybersecurity.cybertraining.security.RateLimiter;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

/**
 * End-to-end tests for the main scenarios in the project brief.
 * They start the real application on a random port with an in-memory H2 database
 * (see src/test/resources/application-test.properties) and call the same REST API
 * that index.html uses, including CSRF tokens and session cookies.
 *
 * Run in IntelliJ: right-click this file > Run 'CybertrainingApplicationTests'.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class CybertrainingApplicationTests {

    @Autowired
    private Environment environment;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ModuleRepository moduleRepository;

    @Autowired
    private QuizAttemptRepository attemptRepository;

    @Autowired
    private ModuleEnrollmentRepository enrollmentRepository;

    // ------------------------------------------------------------------ tests

    @Test
    void fullTrainingWorkflow() throws Exception {
        Browser admin = signedIn("admin@test.local", "AdminPass123");

        // Register -> PENDING
        Browser visitor = new Browser();
        Res reg = visitor.post("/api/auth/register",
                "{\"fullName\":\"Lena Learner\",\"email\":\"lena@test.local\",\"phone\":\"0400 000 000\",\"password\":\"Learner123\"}");
        assertEquals(202, reg.status, reg.body);
        User lena = userRepository.findByEmail("lena@test.local").orElseThrow();
        assertEquals("PENDING", lena.getApprovalStatus());
        assertNotEquals("Learner123", lena.getPassword(), "password must be hashed");
        assertTrue(lena.getPassword().startsWith("$2"), "BCrypt hash expected");

        // Registering the same email again gives the same answer and creates nothing
        assertEquals(202, new Browser().post("/api/auth/register",
                "{\"fullName\":\"Someone Else\",\"email\":\"lena@test.local\",\"password\":\"Other12345\"}").status);

        // Pending user cannot log in
        assertEquals(401, new Browser().login("lena@test.local", "Learner123").status);

        // Admin approves
        assertEquals(200, admin.post("/admin/api/users/" + lena.getId() + "/approve", "{}").status);
        assertEquals("APPROVED", userRepository.findById(lena.getId()).orElseThrow().getApprovalStatus());

        // Admin user list never exposes secrets
        Res users = admin.get("/admin/api/users");
        assertEquals(200, users.status);
        assertFalse(users.body.contains("password"), users.body);
        assertFalse(users.body.contains("twoFactorSecret"), users.body);

        // Approved user logs in; page refresh (/api/auth/me) keeps the session
        Browser learner = signedIn("lena@test.local", "Learner123");
        assertTrue(learner.get("/api/auth/me").body.contains("\"authenticated\":true"));

        // Role-based access control
        assertEquals(403, learner.get("/admin/api/users").status);
        assertEquals(403, learner.get("/api/owner/modules").status);
        assertEquals(401, new Browser().get("/api/learner/modules").status);

        // Missing CSRF token is rejected
        assertEquals(403, learner.postWithoutCsrf("/api/learner/modules/1/restart", "{}").status);

        // Admin creates a module owner
        Res ownerCreated = admin.post("/admin/api/users",
                "{\"fullName\":\"Owen Owner\",\"email\":\"owen@test.local\",\"password\":\"Owner12345\",\"role\":\"MODULE_OWNER\"}");
        assertEquals(201, ownerCreated.status, ownerCreated.body);
        Browser owner = signedIn("owen@test.local", "Owner12345");
        assertEquals(403, owner.get("/admin/api/users").status);

        // Owner creates, edits, adds quiz and publishes a module
        Res created = owner.post("/api/owner/modules",
                "{\"title\":\"Phishing Basics\",\"desc\":\"Spot fake emails\",\"content\":\"Check the sender.\","
                        + "\"category\":\"Threats\",\"duration\":15,\"thumbnail\":\"🎣\",\"color\":\"#7c3aed\",\"passingScore\":50}");
        assertEquals(201, created.status, created.body);
        long moduleId = number(created.body, "id");

        Res edited = owner.put("/api/owner/modules/" + moduleId,
                "{\"title\":\"Phishing Basics v2\",\"desc\":\"Spot fake emails\",\"content\":\"Hover over links.\","
                        + "\"duration\":20,\"videoUrl\":\"https://example.com/intro.mp4\",\"passingScore\":50}");
        assertEquals(200, edited.status, edited.body);
        assertEquals("Phishing Basics v2", moduleRepository.findById(moduleId).orElseThrow().getTitle());

        // javascript: links are refused
        assertEquals(400, owner.put("/api/owner/modules/" + moduleId,
                "{\"title\":\"Phishing Basics v2\",\"videoUrl\":\"javascript:alert(1)\"}").status);

        // Cannot publish without questions
        assertEquals(400, owner.patch("/api/owner/modules/" + moduleId + "/published", "{\"published\":true}").status);

        Res quiz = owner.put("/api/owner/modules/" + moduleId + "/questions",
                "[{\"q\":\"Which link is safe?\",\"options\":[\"a\",\"b\",\"c\",\"d\"],\"answer\":1,\"hint\":\"h\"},"
                        + "{\"q\":\"Report phishing to?\",\"options\":[\"IT\",\"Nobody\",\"Sender\",\"Friends\"],\"answer\":0}]");
        assertEquals(200, quiz.status, quiz.body);

        // Not visible to learners until published
        assertFalse(learner.get("/api/learner/modules").body.contains("Phishing Basics v2"));
        assertEquals(200, owner.patch("/api/owner/modules/" + moduleId + "/published", "{\"published\":true}").status);
        Res learnerModules = learner.get("/api/learner/modules");
        assertTrue(learnerModules.body.contains("Phishing Basics v2"), learnerModules.body);
        assertFalse(learnerModules.body.matches("(?s).*\"answer\":\\d.*"), "answers must not be sent to learners");

        // Learner takes the quiz
        Res start = learner.post("/api/learner/modules/" + moduleId + "/attempts", "{}");
        assertEquals(200, start.status, start.body);
        long attemptId = number(start.body, "attemptId");
        assertFalse(start.body.matches("(?s).*\"answer\":\\d.*"), "quiz must not include correct answers before answering");
        long q1 = numberAt(start.body, "id", 1);
        long q2 = numberAt(start.body, "id", 2);

        Res a1 = learner.post("/api/learner/attempts/" + attemptId + "/answers",
                "{\"questionId\":" + q1 + ",\"answer\":1}");
        assertTrue(a1.body.contains("\"correct\":true"), a1.body);
        // Answers cannot be changed
        assertEquals(409, learner.post("/api/learner/attempts/" + attemptId + "/answers",
                "{\"questionId\":" + q1 + ",\"answer\":2}").status);
        learner.post("/api/learner/attempts/" + attemptId + "/answers", "{\"questionId\":" + q2 + ",\"answer\":3}");

        Res finish = learner.post("/api/learner/attempts/" + attemptId + "/finish", "{}");
        assertEquals(200, finish.status, finish.body);
        assertTrue(finish.body.contains("\"score\":50"), finish.body);
        assertTrue(finish.body.contains("\"passed\":true"), finish.body);
        assertTrue(attemptRepository.findById(attemptId).orElseThrow().isPassed());
        assertTrue(enrollmentRepository.findByUserIdAndModuleId(lena.getId(), moduleId).orElseThrow().isCompleted());

        // Owner cannot delete a module learners have attempted
        assertEquals(409, owner.delete("/api/owner/modules/" + moduleId).status);

        // Log out, log in again: progress is still there
        assertEquals(200, learner.post("/api/auth/logout", "{}").status);
        assertEquals(401, learner.get("/api/learner/modules").status);
        Browser learnerAgain = signedIn("lena@test.local", "Learner123");
        assertTrue(learnerAgain.get("/api/learner/modules").body.contains("\"completed\":true"));
        assertTrue(learnerAgain.get("/api/learner/attempts").body.contains("Phishing Basics v2"));

        // Profile update persists
        assertEquals(200, learnerAgain.put("/api/me/profile",
                "{\"fullName\":\"Lena L. Learner\",\"phone\":\"0411 111 111\",\"photo\":\"\"}").status);
        assertEquals("Lena L. Learner", userRepository.findById(lena.getId()).orElseThrow().getFullName());

        // Owner sees learner progress
        assertTrue(owner.get("/api/owner/learners").body.contains("lena@test.local"));
    }

    @Test
    void passwordResetNeedsAdminApproval() throws Exception {
        Browser admin = signedIn("admin@test.local", "AdminPass123");
        admin.post("/admin/api/users",
                "{\"fullName\":\"Rita Reset\",\"email\":\"rita@test.local\",\"password\":\"OldPass123\",\"role\":\"USER\"}");

        // Unknown email gets exactly the same public answer
        Res unknown = new Browser().post("/api/auth/forgot-password",
                "{\"email\":\"nobody@test.local\",\"newPassword\":\"NewPass123\"}");
        Res known = new Browser().post("/api/auth/forgot-password",
                "{\"email\":\"rita@test.local\",\"newPassword\":\"NewPass123\"}");
        assertEquals(202, unknown.status);
        assertEquals(unknown.body, known.body);

        // Old password still works, new one does not yet
        assertEquals(200, new Browser().login("rita@test.local", "OldPass123").status);
        assertEquals(401, new Browser().login("rita@test.local", "NewPass123").status);

        Res list = admin.get("/admin/api/password-resets");
        assertTrue(list.body.contains("rita@test.local") && list.body.contains("PENDING"), list.body);
        assertFalse(list.body.contains("$2"), "hashes must not be exposed");
        long requestId = number(list.body, "id");

        assertEquals(200, admin.post("/admin/api/password-resets/" + requestId + "/approve", "{}").status);
        assertEquals(200, new Browser().login("rita@test.local", "NewPass123").status);
        assertEquals(401, new Browser().login("rita@test.local", "OldPass123").status);

        // A rejected request leaves the password unchanged
        new Browser().post("/api/auth/forgot-password", "{\"email\":\"rita@test.local\",\"newPassword\":\"Third12345\"}");
        long second = number(admin.get("/admin/api/password-resets").body, "id");
        assertEquals(200, admin.post("/admin/api/password-resets/" + second + "/reject", "{}").status);
        assertEquals(401, new Browser().login("rita@test.local", "Third12345").status);
        assertEquals(200, new Browser().login("rita@test.local", "NewPass123").status);
    }

    @Test
    void adminAccountControlsAndTwoFactor() throws Exception {
        Browser admin = signedIn("admin@test.local", "AdminPass123");

        // Reject a registration -> cannot log in
        new Browser().post("/api/auth/register",
                "{\"fullName\":\"Rex Rejected\",\"email\":\"rex@test.local\",\"password\":\"Rejected123\"}");
        long rexId = userRepository.findByEmail("rex@test.local").orElseThrow().getId();
        assertEquals(200, admin.post("/admin/api/users/" + rexId + "/reject", "{}").status);
        assertEquals("REJECTED", userRepository.findById(rexId).orElseThrow().getApprovalStatus());
        assertEquals(401, new Browser().login("rex@test.local", "Rejected123").status);

        // Disable an account -> cannot log in, and an open session loses access
        Res made = admin.post("/admin/api/users",
                "{\"fullName\":\"Dana Disabled\",\"email\":\"dana@test.local\",\"password\":\"Disable123\",\"role\":\"USER\"}");
        long danaId = number(made.body, "id");
        Browser dana = signedIn("dana@test.local", "Disable123");
        assertEquals(200, admin.put("/admin/api/users/" + danaId + "/status", "{\"enabled\":false}").status);
        assertEquals(401, new Browser().login("dana@test.local", "Disable123").status);
        assertEquals(401, dana.get("/api/learner/modules").status);

        // Change role -> saved
        assertEquals(200, admin.put("/admin/api/users/" + danaId + "/role", "{\"role\":\"MODULE_OWNER\"}").status);
        assertEquals("MODULE_OWNER", userRepository.findById(danaId).orElseThrow().getRole());
        assertEquals(400, admin.put("/admin/api/users/" + danaId + "/role", "{\"role\":\"ADMIN\"}").status);

        // 2FA: enable, then login requires a code
        admin.post("/admin/api/users",
                "{\"fullName\":\"Tom Totp\",\"email\":\"tom@test.local\",\"password\":\"TwoFactor123\",\"role\":\"USER\"}");
        Browser tom = signedIn("tom@test.local", "TwoFactor123");
        Res setup = tom.post("/api/me/2fa/setup", "{}");
        assertEquals(200, setup.status, setup.body);
        String secret = text(setup.body, "secret");
        assertEquals(400, tom.post("/api/me/2fa/enable", "{\"code\":\"000000\"}").status);
        assertEquals(200, tom.post("/api/me/2fa/enable", "{\"code\":\"" + totp(secret) + "\"}").status);

        Browser tomLater = new Browser();
        Res step1 = tomLater.login("tom@test.local", "TwoFactor123");
        assertTrue(step1.body.contains("\"requiresTwoFactor\":true"), step1.body);
        assertEquals(401, tomLater.get("/api/learner/modules").status, "not signed in before the code");
        assertEquals(401, tomLater.post("/api/auth/verify-2fa", "{\"code\":\"123456\"}").status);
        Res step2 = tomLater.post("/api/auth/verify-2fa", "{\"code\":\"" + totp(secret) + "\"}");
        assertEquals(200, step2.status, step2.body);
        assertEquals(200, tomLater.get("/api/learner/modules").status);

        // The admin list shows 2FA status
        assertTrue(admin.get("/admin/api/users").body.contains("\"twoFactorEnabled\":true"));
    }

    @Test
    void rateLimiterBlocksRepeatedAttempts() {
        RateLimiter limiter = new RateLimiter(true);
        for (int i = 0; i < 3; i++) {
            assertTrue(limiter.tryAcquire("k", 3, Duration.ofMinutes(1)));
        }
        assertFalse(limiter.tryAcquire("k", 3, Duration.ofMinutes(1)));
        assertTrue(limiter.tryAcquire("other", 3, Duration.ofMinutes(1)));
    }

    @Test
    void indexPageIsServedWithoutBrowserStorage() throws Exception {
        Res page = new Browser().get("/index.html");
        assertEquals(200, page.status);
        assertFalse(page.body.contains("localStorage"), "index.html must not use localStorage");
        assertFalse(page.body.contains("sessionStorage"), "index.html must not use sessionStorage");
        assertEquals(200, new Browser().get("/").status);
    }

    // ------------------------------------------------------------------ helpers

    private Browser signedIn(String email, String password) throws Exception {
        Browser browser = new Browser();
        Res res = browser.login(email, password);
        assertEquals(200, res.status, "login failed for " + email + ": " + res.body);
        assertTrue(res.body.contains("\"authenticated\":true"), res.body);
        return browser;
    }

    private static String totp(String secret) throws Exception {
        long counter = Math.floorDiv(System.currentTimeMillis() / 1000L, 30L);
        return new DefaultCodeGenerator().generate(secret, counter);
    }

    private static long number(String json, String key) {
        return numberAt(json, key, 1);
    }

    /** The n-th (1-based) numeric value for "key" in a JSON text. */
    private static long numberAt(String json, String key, int occurrence) {
        Matcher matcher = Pattern.compile("\"" + key + "\":(\\d+)").matcher(json);
        for (int i = 0; i < occurrence; i++) {
            assertTrue(matcher.find(), "no " + key + " #" + occurrence + " in " + json);
        }
        return Long.parseLong(matcher.group(1));
    }

    private static String text(String json, String key) {
        Matcher matcher = Pattern.compile("\"" + key + "\":\"([^\"]*)\"").matcher(json);
        assertTrue(matcher.find(), "no " + key + " in " + json);
        return matcher.group(1);
    }

    private record Res(int status, String body) {
    }

    /** A tiny "browser": keeps cookies (session + XSRF-TOKEN) and sends the CSRF header. */
    private class Browser {
        private final HttpClient client = HttpClient.newBuilder()
                .cookieHandler(new CookieManager())
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();

        Res login(String email, String password) throws Exception {
            return post("/api/auth/login", "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
        }

        Res get(String path) throws Exception {
            return send(HttpRequest.newBuilder(uri(path)).GET());
        }

        Res post(String path, String json) throws Exception {
            return send(withCsrf(path).POST(HttpRequest.BodyPublishers.ofString(json)));
        }

        Res put(String path, String json) throws Exception {
            return send(withCsrf(path).PUT(HttpRequest.BodyPublishers.ofString(json)));
        }

        Res patch(String path, String json) throws Exception {
            return send(withCsrf(path).method("PATCH", HttpRequest.BodyPublishers.ofString(json)));
        }

        Res delete(String path) throws Exception {
            return send(withCsrf(path).DELETE());
        }

        Res postWithoutCsrf(String path, String json) throws Exception {
            return send(HttpRequest.newBuilder(uri(path))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json)));
        }

        private HttpRequest.Builder withCsrf(String path) throws Exception {
            Res csrf = get("/api/auth/csrf");
            return HttpRequest.newBuilder(uri(path))
                    .header("Content-Type", "application/json")
                    .header(text(csrf.body, "headerName"), text(csrf.body, "token"));
        }

        private Res send(HttpRequest.Builder builder) throws Exception {
            HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            return new Res(response.statusCode(), response.body());
        }

        private URI uri(String path) {
            return URI.create("http://localhost:" + environment.getProperty("local.server.port") + path);
        }
    }
}
