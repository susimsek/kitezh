package io.github.susimsek.springauthserversamples.security;

import java.util.Set;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;

/** Application-specific security settings stored in a registered client's settings map. */
public final class ClientSecuritySettings {

    public static final String REQUIRE_DPOP_PROOF = "settings.client.require-dpop-proof";
    public static final String REQUIRE_DPOP_JKT = "settings.client.require-dpop-jkt";
    public static final String DPOP_REFRESH_TOKEN_ONLY = "settings.client.dpop-refresh-token-only";
    public static final String DPOP_SIGNING_ALGORITHMS = "settings.client.dpop-signing-algorithms";
    public static final String CIBA_DELIVERY_MODE = "settings.client.ciba-delivery-mode";
    public static final String CIBA_NOTIFICATION_ENDPOINT =
            "settings.client.ciba-notification-endpoint";
    public static final String CIBA_CLIENT_NOTIFICATION_TOKEN =
            "settings.client.ciba-client-notification-token";
    public static final String CIBA_REQUEST_SIGNING_ALGORITHMS =
            "settings.client.ciba-request-signing-algorithms";
    public static final Set<String> DEFAULT_DPOP_SIGNING_ALGORITHMS = Set.of("RS256", "ES256");
    public static final Set<String> DEFAULT_CIBA_REQUEST_SIGNING_ALGORITHMS =
            Set.of("RS256", "ES256");
    public static final String CIBA_POLL = "poll";
    public static final String CIBA_PING = "ping";
    public static final String CIBA_PUSH = "push";
    public static final Set<String> CIBA_DELIVERY_MODES = Set.of(CIBA_POLL, CIBA_PING, CIBA_PUSH);

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

    public static String cibaDeliveryMode(RegisteredClient client) {
        Object setting = client.getClientSettings().getSetting(CIBA_DELIVERY_MODE);
        return setting instanceof String mode && CIBA_DELIVERY_MODES.contains(mode)
                ? mode
                : CIBA_POLL;
    }

    public static String cibaNotificationEndpoint(RegisteredClient client) {
        Object setting = client.getClientSettings().getSetting(CIBA_NOTIFICATION_ENDPOINT);
        return setting instanceof String endpoint && !endpoint.isBlank() ? endpoint : null;
    }

    public static String cibaClientNotificationToken(RegisteredClient client) {
        Object setting = client.getClientSettings().getSetting(CIBA_CLIENT_NOTIFICATION_TOKEN);
        return setting instanceof String token && !token.isBlank() ? token : null;
    }

    public static Set<String> allowedCibaRequestSigningAlgorithms(RegisteredClient client) {
        Object setting = client.getClientSettings().getSetting(CIBA_REQUEST_SIGNING_ALGORITHMS);
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
        return DEFAULT_CIBA_REQUEST_SIGNING_ALGORITHMS;
    }
}
