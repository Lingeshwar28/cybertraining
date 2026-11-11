package com.cybersecurity.cybertraining.service;

import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.UserRepository;
import dev.samstevens.totp.code.CodeVerifier;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.qr.QrGenerator;
import dev.samstevens.totp.secret.SecretGenerator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import static dev.samstevens.totp.util.Utils.getDataUriForImage;

@Service
public class TwoFactorService {

    private final UserRepository userRepository;
    private final SecretGenerator secretGenerator;
    private final QrGenerator qrGenerator;
    private final CodeVerifier codeVerifier;
    private final boolean required;

    public TwoFactorService(
            UserRepository userRepository,
            SecretGenerator secretGenerator,
            QrGenerator qrGenerator,
            CodeVerifier codeVerifier,
            @Value("${app.security.require-2fa:true}") boolean required) {

        this.userRepository = userRepository;
        this.secretGenerator = secretGenerator;
        this.qrGenerator = qrGenerator;
        this.codeVerifier = codeVerifier;
        this.required = required;
    }

    /**
     * true = every account must use an authenticator app.
     * Accounts without 2FA are taken through setup during their next sign-in.
     * Controlled by app.security.require-2fa in application.properties.
     */
    public boolean isRequired() {
        return required;
    }

    public String generateSecret() {
        return secretGenerator.generate();
    }

    public String generateQrCode(String email, String secret)
            throws Exception {

        QrData data = new QrData.Builder()
                .label(email)
                .secret(secret)
                .issuer("CyberSecure Training")
                .build();

        byte[] imageData = qrGenerator.generate(data);

        return getDataUriForImage(
                imageData,
                qrGenerator.getImageMimeType()
        );
    }

    public boolean verifyCode(
            String secret,
            String code) {

        if (secret == null || secret.isBlank()) {
            return false;
        }

        if (code == null || !code.matches("\\d{6}")) {
            return false;
        }

        return codeVerifier.isValidCode(
                secret,
                code
        );
    }

    public void enableTwoFactor(
            User user,
            String secret) {

        user.setTwoFactorSecret(secret);
        user.setTwoFactorEnabled(true);

        userRepository.save(user);
    }

    public void disableTwoFactor(User user) {

        user.setTwoFactorEnabled(false);
        user.setTwoFactorSecret(null);

        userRepository.save(user);
    }
}