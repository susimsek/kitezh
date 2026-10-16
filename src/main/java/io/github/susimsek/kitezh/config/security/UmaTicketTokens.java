package io.github.susimsek.kitezh.config.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/** Generates opaque UMA tickets and hashes them before persistence. */
public final class UmaTicketTokens {

    private static final SecureRandom RANDOM = new SecureRandom();

    private UmaTicketTokens() {}

    public static String generate() {
        byte[] value = new byte[32];
        RANDOM.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    public static String digest(String ticket) {
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(ticket.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException _) {
            throw new IllegalStateException("SHA-256 is unavailable");
        }
    }
}
