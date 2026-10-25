package io.github.susimsek.kitezh.mcp.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** Stores short-lived, single-use MCP write previews bound to the authenticated caller. */
@Component
public final class McpWritePreviewRegistry {

    private static final Duration PREVIEW_LIFETIME = Duration.ofMinutes(5);
    private static final int MAX_PREVIEWS = 2_048;

    private final Map<String, Preview> previews = new ConcurrentHashMap<>();
    private final Clock clock;

    public McpWritePreviewRegistry() {
        this(Clock.systemUTC());
    }

    McpWritePreviewRegistry(Clock clock) {
        this.clock = clock;
    }

    public synchronized Preview create(
            String caller, String action, String target, String expectedState, String newState) {
        removeExpired();
        if (previews.size() >= MAX_PREVIEWS) {
            throw new IllegalStateException("Too many pending MCP write previews");
        }
        Instant expiresAt = clock.instant().plus(PREVIEW_LIFETIME);
        Preview preview = new Preview(caller, action, target, expectedState, newState, expiresAt);
        String token = UUID.randomUUID().toString();
        previews.put(token, preview);
        return preview.withToken(token);
    }

    public Preview consume(String token, String caller, String action) {
        Preview preview = token == null ? null : previews.get(token);
        if (preview == null
                || !preview.expiresAt().isAfter(clock.instant())
                || !preview.caller().equals(caller)
                || !preview.action().equals(action)) {
            throw new IllegalArgumentException("Write preview is expired or invalid");
        }
        if (!previews.remove(token, preview)) {
            throw new IllegalArgumentException("Write preview is expired or invalid");
        }
        return preview;
    }

    private void removeExpired() {
        Instant now = clock.instant();
        previews.entrySet().removeIf(entry -> now.isAfter(entry.getValue().expiresAt()));
    }

    public record Preview(
            String caller,
            String action,
            String target,
            String expectedState,
            String newState,
            Instant expiresAt,
            String token) {

        public Preview(
                String caller,
                String action,
                String target,
                String expectedState,
                String newState,
                Instant expiresAt) {
            this(caller, action, target, expectedState, newState, expiresAt, null);
        }

        public Preview withToken(String previewToken) {
            return new Preview(
                    caller, action, target, expectedState, newState, expiresAt, previewToken);
        }
    }
}
