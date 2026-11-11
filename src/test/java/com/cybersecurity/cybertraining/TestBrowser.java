package com.cybersecurity.cybertraining;

import dev.samstevens.totp.code.DefaultCodeGenerator;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A tiny "browser" for the tests: keeps cookies (session + XSRF-TOKEN) and sends
 * the CSRF header, exactly like index.html does.
 */
class TestBrowser {

    record Res(int status, String body) {
    }

    private final String baseUrl;
    private final HttpClient client = HttpClient.newBuilder()
            .cookieHandler(new CookieManager())
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    TestBrowser(String port) {
        this.baseUrl = "http://localhost:" + port;
    }

    Res login(String email, String password) throws Exception {
        return post("/api/auth/login", "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }

    Res get(String path) throws Exception {
        return send(HttpRequest.newBuilder(URI.create(baseUrl + path)).GET());
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
        return send(HttpRequest.newBuilder(URI.create(baseUrl + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json)));
    }

    private HttpRequest.Builder withCsrf(String path) throws Exception {
        Res csrf = get("/api/auth/csrf");
        return HttpRequest.newBuilder(URI.create(baseUrl + path))
                .header("Content-Type", "application/json")
                .header(text(csrf.body(), "headerName"), text(csrf.body(), "token"));
    }

    private Res send(HttpRequest.Builder builder) throws Exception {
        HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        return new Res(response.statusCode(), response.body());
    }

    /** Current 6-digit code for an authenticator secret (what the phone app would show). */
    static String totp(String secret) throws Exception {
        long counter = Math.floorDiv(System.currentTimeMillis() / 1000L, 30L);
        return new DefaultCodeGenerator().generate(secret, counter);
    }

    static long number(String json, String key) {
        return numberAt(json, key, 1);
    }

    /** The n-th (1-based) numeric value for "key" in a JSON text. */
    static long numberAt(String json, String key, int occurrence) {
        Matcher matcher = Pattern.compile("\"" + key + "\":(\\d+)").matcher(json);
        for (int i = 0; i < occurrence; i++) {
            if (!matcher.find()) {
                throw new AssertionError("no " + key + " #" + occurrence + " in " + json);
            }
        }
        return Long.parseLong(matcher.group(1));
    }

    static String text(String json, String key) {
        Matcher matcher = Pattern.compile("\"" + key + "\":\"([^\"]*)\"").matcher(json);
        if (!matcher.find()) {
            throw new AssertionError("no " + key + " in " + json);
        }
        return matcher.group(1);
    }
}