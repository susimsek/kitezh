package io.github.susimsek.kitezh.service.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LoginRateLimitService {

    private final ApplicationProperties applicationProperties;
    private final LoginSettingsService loginSettingsService;
    private final Cache<String, Window> windows =
            Caffeine.newBuilder()
                    .expireAfterAccess(Duration.ofHours(1))
                    .maximumSize(100_000)
                    .build();

    public boolean isAllowed(String username, String ipAddress) {
        return check(username, ipAddress).allowed();
    }

    public RateLimitDecision check(String username, String ipAddress) {
        ApplicationProperties.BruteForce policy =
                loginSettingsService == null
                        ? applicationProperties.security().bruteForce()
                        : loginSettingsService.bruteForcePolicy();
        if (!policy.enabled()) {
            return new RateLimitDecision(true, -1, -1, 0);
        }
        String ip = ip(ipAddress);
        String user = user(username);
        Counter ipCounter = consume("ip:" + ip, policy.ipRequestsPerMinute());
        Counter userCounter =
                consume("user-ip:" + user + ":" + ip, policy.usernameIpRequestsPerMinute());
        long limit = Math.min(ipCounter.limit(), userCounter.limit());
        long remaining =
                Math.clamp(
                        Math.min(ipCounter.remaining(), userCounter.remaining()),
                        0L,
                        Long.MAX_VALUE);
        long resetSeconds = Math.max(ipCounter.resetSeconds(), userCounter.resetSeconds());
        return new RateLimitDecision(
                ipCounter.allowed() && userCounter.allowed(), limit, remaining, resetSeconds);
    }

    public void clear(String username, String ipAddress) {
        String ip = ip(ipAddress);
        String user = user(username);
        windows.invalidate("ip:" + ip);
        windows.invalidate("user-ip:" + user + ":" + ip);
    }

    private static String ip(String value) {
        return value == null || value.isBlank() ? "unknown" : value;
    }

    private static String user(String value) {
        return value == null || value.isBlank() ? "unknown" : value.trim().toLowerCase(Locale.ROOT);
    }

    private Counter consume(String key, int limit) {
        if (limit <= 0) {
            return new Counter(false, 0, 0, 60);
        }
        Instant now = Instant.now();
        Window updated =
                windows.asMap()
                        .compute(
                                key,
                                (ignored, current) ->
                                        current == null
                                                        || current.startedAt()
                                                                .plus(Duration.ofMinutes(1))
                                                                .isBefore(now)
                                                ? new Window(now, 1)
                                                : new Window(
                                                        current.startedAt(), current.count() + 1));
        long remaining = Math.max(0, limit - updated.count());
        long resetSeconds =
                Math.max(
                        1,
                        Duration.between(now, updated.startedAt().plus(Duration.ofMinutes(1)))
                                .toSeconds());
        return new Counter(updated.count() <= limit, limit, remaining, resetSeconds);
    }

    public record RateLimitDecision(
            boolean allowed, long limit, long remaining, long resetSeconds) {}

    private record Counter(boolean allowed, long limit, long remaining, long resetSeconds) {}

    private record Window(Instant startedAt, int count) {}
}
