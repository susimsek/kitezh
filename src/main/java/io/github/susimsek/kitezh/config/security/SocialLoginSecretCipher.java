package io.github.susimsek.kitezh.config.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/** Encrypts social client secrets before they are persisted. */
@Component
public class SocialLoginSecretCipher {

    private static final String PREFIX = "v1:";
    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH = 128;

    private final SocialLoginProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public SocialLoginSecretCipher(SocialLoginProperties properties) {
        this.properties = properties;
    }

    public String encrypt(String value) {
        try {
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(TAG_LENGTH, iv));
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            byte[] payload = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, payload, 0, iv.length);
            System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);
            return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(payload);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException(
                    "The social login encryption key is invalid", exception);
        }
    }

    public boolean isConfigured() {
        return properties.encryptionKey() != null && !properties.encryptionKey().isBlank();
    }

    public String decrypt(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        if (!value.startsWith(PREFIX)) {
            throw new IllegalStateException("The social login secret has an unsupported format");
        }
        try {
            byte[] payload = Base64.getUrlDecoder().decode(value.substring(PREFIX.length()));
            if (payload.length <= IV_LENGTH) {
                throw new IllegalStateException("The social login secret is invalid");
            }
            byte[] iv = java.util.Arrays.copyOf(payload, IV_LENGTH);
            byte[] encrypted = java.util.Arrays.copyOfRange(payload, IV_LENGTH, payload.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(TAG_LENGTH, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new IllegalStateException(
                    "The social login secret could not be decrypted", exception);
        }
    }

    private SecretKeySpec key() {
        String encryptionKey = properties.encryptionKey();
        if (encryptionKey == null || encryptionKey.isBlank()) {
            throw new IllegalStateException(
                    "SOCIAL_LOGIN_ENCRYPTION_KEY must be configured before saving social secrets");
        }
        try {
            return new SecretKeySpec(
                    MessageDigest.getInstance("SHA-256")
                            .digest(encryptionKey.getBytes(StandardCharsets.UTF_8)),
                    "AES");
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
