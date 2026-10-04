package io.github.susimsek.kitezh.service.security;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import java.util.Locale;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

/** Bounded OAuth2 and authentication event counters for operational dashboards. */
@Component
public class OAuth2ObservabilityMetrics {

    static final String METER_NAME = "spring.authorization.server.events";
    private static final String UNKNOWN = "unknown";

    @Nullable private final MeterRegistry meterRegistry;

    public OAuth2ObservabilityMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    /** Creates a recorder that intentionally discards events for direct unit-test construction. */
    public static OAuth2ObservabilityMetrics noop() {
        return new OAuth2ObservabilityMetrics(null);
    }

    public void recordAuthentication(
            String event,
            String outcome,
            @Nullable String error,
            @Nullable String clientId,
            @Nullable String provider) {
        recordEvent(event, outcome, error, null, null, clientId, provider);
    }

    public void recordToken(
            String event,
            String outcome,
            @Nullable String error,
            @Nullable String grantType,
            @Nullable String tokenType,
            @Nullable String clientId) {
        recordEvent(event, outcome, error, grantType, tokenType, clientId, null);
    }

    public void recordOAuthError(@Nullable String grantType, String error) {
        recordEvent("oauth_error", "failure", error, grantType, null, null, null);
    }

    public void recordLogout(String outcome, @Nullable String provider) {
        recordEvent("logout", outcome, null, null, null, null, provider);
    }

    void recordEvent(
            String event,
            String outcome,
            @Nullable String error,
            @Nullable String grantType,
            @Nullable String tokenType,
            @Nullable String clientId,
            @Nullable String provider) {
        if (meterRegistry == null) {
            return;
        }
        meterRegistry
                .counter(
                        METER_NAME,
                        Tags.of(
                                "event", value(event),
                                "outcome", value(outcome),
                                "error", value(error),
                                "grant_type", value(grantType),
                                "token_type", value(tokenType),
                                "client_id", value(clientId),
                                "provider", value(provider)))
                .increment();
    }

    private static String value(@Nullable String value) {
        return value == null || value.isBlank() ? UNKNOWN : value.toLowerCase(Locale.ROOT);
    }
}
