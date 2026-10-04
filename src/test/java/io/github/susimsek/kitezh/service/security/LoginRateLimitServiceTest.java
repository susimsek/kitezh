package io.github.susimsek.kitezh.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class LoginRateLimitServiceTest {

    @Test
    void allowsWhenDisabledAndConsumesBothIpAndUserBuckets() {
        LoginSettingsService settings = mock(LoginSettingsService.class);
        ApplicationProperties properties = properties(true, 2, 1);
        when(settings.bruteForcePolicy()).thenReturn(properties.security().bruteForce());
        LoginRateLimitService service = new LoginRateLimitService(properties, settings);

        assertThat(service.isAllowed(" Alice ", "127.0.0.1")).isTrue();
        assertThat(service.check("Alice", "127.0.0.1").remaining()).isZero();
        assertThat(service.check("Alice", "127.0.0.1").allowed()).isFalse();
        assertThat(service.check(null, null).limit()).isEqualTo(1);
        service.clear("Alice", "127.0.0.1");
        assertThat(service.check("Alice", "127.0.0.1").allowed()).isTrue();
    }

    @Test
    void returnsImmediateDenialForNonPositiveLimitsAndSupportsNullSettings() {
        ApplicationProperties properties = properties(true, 0, 0);
        LoginRateLimitService service = new LoginRateLimitService(properties, null);

        var decision = service.check("alice", "");

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.limit()).isZero();
        assertThat(decision.resetSeconds()).isEqualTo(60);

        ApplicationProperties disabled = properties(false, 5, 5);
        LoginRateLimitService disabledService = new LoginRateLimitService(disabled, null);
        assertThat(disabledService.check("alice", "127.0.0.1"))
                .isEqualTo(new LoginRateLimitService.RateLimitDecision(true, -1, -1, 0));
    }

    private static ApplicationProperties properties(boolean enabled, int ipLimit, int userLimit) {
        var bruteForce =
                new ApplicationProperties.BruteForce(
                        enabled,
                        5,
                        Duration.ofSeconds(1),
                        Duration.ofMinutes(1),
                        Duration.ofMinutes(1),
                        Duration.ofMinutes(15),
                        Duration.ofHours(12),
                        3,
                        false,
                        ipLimit,
                        userLimit);
        return new ApplicationProperties(
                new ApplicationProperties.Cache(
                        new ApplicationProperties.Caffeine(Duration.ofHours(1), 500, 1000)),
                new ApplicationProperties.Session("0 * * * * *"),
                new ApplicationProperties.AuthorizationServer("http://localhost"),
                new ApplicationProperties.Mail(false, "from", "http://localhost"),
                new ApplicationProperties.Security(
                        new ApplicationProperties.PasswordPolicy(), bruteForce));
    }
}
