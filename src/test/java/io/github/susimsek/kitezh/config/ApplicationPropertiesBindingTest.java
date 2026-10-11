package io.github.susimsek.kitezh.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.config.http.GitHubApiProperties;
import io.github.susimsek.kitezh.config.observability.LoggingProperties;
import io.github.susimsek.kitezh.config.security.SocialLoginProperties;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.SystemEnvironmentPropertySource;

class ApplicationPropertiesBindingTest {

    private final ApplicationContextRunner contextRunner =
            new ApplicationContextRunner().withUserConfiguration(PropertiesConfiguration.class);

    @Test
    void bindsAuthorizationServerIssuerOverride() {
        contextRunner
                .withPropertyValues("app.authorization-server.issuer=https://issuer.example")
                .run(
                        context -> {
                            ApplicationProperties properties =
                                    context.getBean(ApplicationProperties.class);
                            assertThat(properties.authorizationServer().issuer())
                                    .isEqualTo("https://issuer.example");
                            assertThat(properties.cache().caffeine().overrides()).isEmpty();
                        });
    }

    @Test
    void bindsAuthorizationServerIssuerFromEnvironmentVariable() {
        contextRunner
                .withInitializer(
                        context ->
                                context.getEnvironment()
                                        .getPropertySources()
                                        .addFirst(
                                                new SystemEnvironmentPropertySource(
                                                        "systemEnvironment",
                                                        Map.of(
                                                                "APP_AUTHORIZATIONSERVER_ISSUER",
                                                                "https://kitezh.onrender.com"))))
                .run(
                        context ->
                                assertThat(
                                                context.getBean(ApplicationProperties.class)
                                                        .authorizationServer()
                                                        .issuer())
                                        .isEqualTo("https://kitezh.onrender.com"));
    }

    @Test
    void bindsNestedApplicationSettings() {
        contextRunner
                .withPropertyValues(
                        "app.cache.caffeine.ttl=PT2H",
                        "app.cache.caffeine.overrides.example.maximum-size=25",
                        "app.authorization-server.offline-session-idle=P7D",
                        "app.web-authn.rp-name=Example",
                        "app.registration-captcha.provider=recaptcha-v3",
                        "app.dpop.nonce-required=true",
                        "app.security.password-policy.minimum-length=16",
                        "app.security.brute-force.max-failures=8")
                .run(
                        context -> {
                            ApplicationProperties properties =
                                    context.getBean(ApplicationProperties.class);
                            assertThat(properties.cache().caffeine().ttl())
                                    .isEqualTo(Duration.ofHours(2));
                            assertThat(properties.cache().caffeine().overrides())
                                    .containsKey("example");
                            assertThat(
                                            properties
                                                    .cache()
                                                    .caffeine()
                                                    .overrides()
                                                    .get("example")
                                                    .maximumSize())
                                    .isEqualTo(25);
                            assertThat(properties.authorizationServer().offlineSessionIdle())
                                    .isEqualTo(Duration.ofDays(7));
                            assertThat(properties.webAuthn().rpName()).isEqualTo("Example");
                            assertThat(properties.registrationCaptcha().provider())
                                    .isEqualTo("recaptcha-v3");
                            assertThat(properties.dpop().nonceRequired()).isTrue();
                            assertThat(properties.security().passwordPolicy().minimumLength())
                                    .isEqualTo(16);
                            assertThat(properties.security().bruteForce().maxFailures())
                                    .isEqualTo(8);
                        });
    }

    @Test
    void bindsOtherConfigurationProperties() {
        contextRunner
                .withPropertyValues(
                        "app.github-api.token=test-token",
                        "app.logging.server.enabled=false",
                        "app.social-login.encryption-key=test-key")
                .run(
                        context -> {
                            assertThat(context.getBean(GitHubApiProperties.class).token())
                                    .isEqualTo("test-token");
                            assertThat(
                                            context.getBean(LoggingProperties.class)
                                                    .getServer()
                                                    .isEnabled())
                                    .isFalse();
                            assertThat(context.getBean(SocialLoginProperties.class).encryptionKey())
                                    .isEqualTo("test-key");
                        });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties({
        ApplicationProperties.class,
        GitHubApiProperties.class,
        LoggingProperties.class,
        SocialLoginProperties.class
    })
    static class PropertiesConfiguration {}
}
