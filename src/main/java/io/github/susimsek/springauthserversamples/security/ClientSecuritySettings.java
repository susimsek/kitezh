package io.github.susimsek.springauthserversamples.security;

import java.util.Set;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;

/** Application-specific security settings stored in a registered client's settings map. */
public final class ClientSecuritySettings {

    public static final String REQUIRE_DPOP_PROOF = "settings.client.require-dpop-proof";
    public static final String REQUIRE_DPOP_JKT = "settings.client.require-dpop-jkt";
    public static final String DPOP_REFRESH_TOKEN_ONLY = "settings.client.dpop-refresh-token-only";
    public static final String DPOP_SIGNING_ALGORITHMS = "settings.client.dpop-signing-algorithms";
    public static final Set<String> DEFAULT_DPOP_SIGNING_ALGORITHMS = Set.of("RS256", "ES256");

    private ClientSecuritySettings() {}

    public static boolean requiresDpopProof(RegisteredClient client) {
        return Boolean.TRUE.equals(client.getClientSettings().getSetting(REQUIRE_DPOP_PROOF));
    }

    public static boolean requiresDpopJkt(RegisteredClient client) {
        return Boolean.TRUE.equals(client.getClientSettings().getSetting(REQUIRE_DPOP_JKT));
    }

    public static boolean requiresDpopForRefreshToken(RegisteredClient client) {
        return Boolean.TRUE.equals(client.getClientSettings().getSetting(DPOP_REFRESH_TOKEN_ONLY));
    }

    public static Set<String> allowedDpopSigningAlgorithms(RegisteredClient client) {
        Object setting = client.getClientSettings().getSetting(DPOP_SIGNING_ALGORITHMS);
        if (setting instanceof Iterable<?> values) {
            Set<String> algorithms =
                    java.util.stream.StreamSupport.stream(values.spliterator(), false)
                            .filter(String.class::isInstance)
                            .map(String.class::cast)
                            .collect(java.util.stream.Collectors.toUnmodifiableSet());
            if (!algorithms.isEmpty()) {
                return algorithms;
            }
        }
        return DEFAULT_DPOP_SIGNING_ALGORITHMS;
    }
}
