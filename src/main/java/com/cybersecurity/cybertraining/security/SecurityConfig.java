package com.cybersecurity.cybertraining.security;

import com.cybersecurity.cybertraining.service.DatabaseUserDetailsService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

/**
 * Spring Security setup.
 *
 * - Passwords are hashed with BCrypt.
 * - Sign-in is done by AuthController (/api/auth/login + /api/auth/verify-2fa),
 *   which stores the login in the HTTP session.
 * - Every POST/PUT/PATCH/DELETE must carry the CSRF token (header X-XSRF-TOKEN).
 *   index.html gets the token from GET /api/auth/csrf.
 * - URLs are restricted by role:
 *     /api/learner/**  -> USER
 *     /api/owner/**    -> MODULE_OWNER
 *     /admin/**        -> ADMIN
 */
@Configuration
public class SecurityConfig {

    private final DatabaseUserDetailsService userDetailsService;

    public SecurityConfig(DatabaseUserDetailsService userDetailsService) {
        this.userDetailsService = userDetailsService;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            SecurityContextRepository securityContextRepository) throws Exception {

        http
                .securityContext(context -> context
                        .securityContextRepository(securityContextRepository))

                .authenticationProvider(authenticationProvider())

                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/",
                                "/index.html",
                                "/favicon.ico",
                                "/error",
                                "/api/auth/**"
                        ).permitAll()

                        .requestMatchers("/api/learner/**").hasRole("USER")
                        .requestMatchers("/api/owner/**").hasRole("MODULE_OWNER")
                        .requestMatchers("/admin/**").hasRole("ADMIN")

                        .anyRequest().authenticated()
                )

                // index.html is the only sign-in screen, so the default
                // Spring login form, HTTP Basic and /logout page are switched off.
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)

                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) ->
                                writeJson(response, HttpStatus.UNAUTHORIZED,
                                        "Please sign in to continue."))
                        .accessDeniedHandler((request, response, exception) ->
                                writeJson(response, HttpStatus.FORBIDDEN,
                                        "You do not have permission to do that, or your security token expired. Refresh the page and try again."))
                );

        return http.build();
    }

    private static void writeJson(HttpServletResponse response, HttpStatus status, String message)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"message\":\"" + message.replace("\"", "'") + "\"}");
    }
}
