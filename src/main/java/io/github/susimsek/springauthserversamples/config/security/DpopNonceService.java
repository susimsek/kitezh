package io.github.susimsek.springauthserversamples.config.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import org.springframework.util.StringUtils;

/** Issues short-lived, single-use DPoP nonce challenges for protected resources. */
public final class DpopNonceService {

    private static final String ANONYMOUS_BINDING = "anonymous";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final boolean required;
    private final Cache<String, String> nonces;

    public DpopNonceService(ApplicationProperties.DPoP settings) {
        this.required = settings.nonceRequired();
        Duration ttl =
                settings.nonceTtl().isNegative() ? Duration.ofMinutes(5) : settings.nonceTtl();
        this.nonces = Caffeine.newBuilder().expireAfterWrite(ttl).maximumSize(10_000).build();
    }

    public boolean isRequired() {
        return this.required;
    }

    public String issue(String authorizationHeader) {
        String nonce = randomNonce();
        this.nonces.put(bindingKey(authorizationHeader), nonce);
        return nonce;
    }

    public boolean consume(String authorizationHeader, String nonce) {
        if (!this.required || !StringUtils.hasText(nonce)) {
            return false;
        }
        String key = bindingKey(authorizationHeader);
        String expected = this.nonces.getIfPresent(key);
        return nonce.equals(expected) && this.nonces.asMap().remove(key, nonce);
    }

    private static String bindingKey(String authorizationHeader) {
        if (!StringUtils.hasText(authorizationHeader)) {
            return ANONYMOUS_BINDING;
        }
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(authorizationHeader.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private static String randomNonce() {
        byte[] nonce = new byte[32];
        RANDOM.nextBytes(nonce);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);
    }
}
