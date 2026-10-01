package io.github.susimsek.springauthserversamples.config.security;

import io.github.susimsek.springauthserversamples.security.OfflineAccessSettings;
import io.github.susimsek.springauthserversamples.service.admin.OfflineAccessPolicyService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import org.jspecify.annotations.Nullable;
import org.springframework.security.crypto.keygen.Base64StringKeyGenerator;
import org.springframework.security.crypto.keygen.StringKeyGenerator;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.token.OAuth2RefreshTokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.util.Assert;

final class ConsoleRefreshTokenGenerator implements OAuth2TokenGenerator<OAuth2RefreshToken> {

    private static final String OFFLINE_ACCESS_SCOPE = "offline_access";
    private static final Duration DEFAULT_OFFLINE_SESSION_IDLE = Duration.ofDays(30);

    private final OAuth2RefreshTokenGenerator defaultGenerator = new OAuth2RefreshTokenGenerator();
    private final StringKeyGenerator refreshTokenGenerator =
            new Base64StringKeyGenerator(Base64.getUrlEncoder().withoutPadding(), 96);
    private final Clock clock = Clock.systemUTC();
    private final Duration offlineSessionIdle;
    private final OfflineAccessPolicyService offlineAccessPolicyService;

    ConsoleRefreshTokenGenerator() {
        this(DEFAULT_OFFLINE_SESSION_IDLE);
    }

    ConsoleRefreshTokenGenerator(Duration offlineSessionIdle) {
        this(offlineSessionIdle, null);
    }

    ConsoleRefreshTokenGenerator(
            Duration offlineSessionIdle, OfflineAccessPolicyService offlineAccessPolicyService) {
        Assert.notNull(offlineSessionIdle, "offlineSessionIdle cannot be null");
        Assert.isTrue(
                !offlineSessionIdle.isZero() && !offlineSessionIdle.isNegative(),
                "offlineSessionIdle must be positive");
        this.offlineSessionIdle = offlineSessionIdle;
        this.offlineAccessPolicyService = offlineAccessPolicyService;
    }

    @Override
    public @Nullable OAuth2RefreshToken generate(OAuth2TokenContext context) {
        if (!OAuth2TokenType.REFRESH_TOKEN.equals(context.getTokenType())) {
            return null;
        }
        boolean consoleClient =
                ConsoleClients.ALL.contains(context.getRegisteredClient().getClientId());
        boolean offlineAccess = context.getAuthorizedScopes().contains(OFFLINE_ACCESS_SCOPE);
        if (!consoleClient && !offlineAccess) {
            return defaultGenerator.generate(context);
        }

        Instant issuedAt = clock.instant();
        if (!offlineAccess) {
            Duration timeToLive =
                    context.getRegisteredClient().getTokenSettings().getRefreshTokenTimeToLive();
            return new OAuth2RefreshToken(
                    refreshTokenGenerator.generateKey(), issuedAt, issuedAt.plus(timeToLive));
        }
        Duration idle =
                offlineAccessPolicyService == null
                        ? offlineSessionIdle
                        : offlineAccessPolicyService.idleTimeout(context.getRegisteredClient());
        Instant sessionStartedAt = sessionStartedAt(context, issuedAt);
        Duration max =
                offlineAccessPolicyService == null
                        ? null
                        : offlineAccessPolicyService.maxLifespan(context.getRegisteredClient());
        Instant expiresAt = issuedAt.plus(idle);
        if (max != null) {
            expiresAt =
                    expiresAt.isBefore(sessionStartedAt.plus(max))
                            ? expiresAt
                            : sessionStartedAt.plus(max);
        }
        return new OAuth2RefreshToken(refreshTokenGenerator.generateKey(), issuedAt, expiresAt);
    }

    private static Instant sessionStartedAt(OAuth2TokenContext context, Instant fallback) {
        if (context.getAuthorization() == null) {
            return fallback;
        }
        Object value =
                context.getAuthorization().getAttribute(OfflineAccessSettings.SESSION_STARTED_AT);
        if (value instanceof Instant instant) {
            return instant;
        }
        if (value instanceof String string) {
            try {
                return Instant.parse(string);
            } catch (RuntimeException _) {
                return fallback;
            }
        }
        return fallback;
    }
}
