package io.github.susimsek.kitezh.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/** Derives the public OIDC session identifier without exposing the browser session ID. */
public final class OidcSessionIdentifier {

    private OidcSessionIdentifier() {}

    public static String fromSessionId(String sessionId) {
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(sessionId.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is required for OIDC session identifiers", ex);
        }
    }

    public static boolean matches(String oidcSessionId, String sessionId) {
        return oidcSessionId != null
                && sessionId != null
                && MessageDigest.isEqual(
                        oidcSessionId.getBytes(StandardCharsets.US_ASCII),
                        fromSessionId(sessionId).getBytes(StandardCharsets.US_ASCII));
    }
}
