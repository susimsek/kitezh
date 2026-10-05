package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.service.security.OAuth2ObservabilityMetrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

class ObservabilityOAuth2TokenGeneratorTest {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final OAuth2ObservabilityMetrics metrics = new OAuth2ObservabilityMetrics(registry);
    private final OAuth2TokenContext context = mock(OAuth2TokenContext.class);

    @Test
    void recordsAccessAndRefreshTokens() {
        RegisteredClient client = mock(RegisteredClient.class);
        when(client.getClientId()).thenReturn("demo-client");
        when(context.getRegisteredClient()).thenReturn(client);
        when(context.getAuthorizationGrantType())
                .thenReturn(AuthorizationGrantType.CLIENT_CREDENTIALS);
        when(context.getTokenType()).thenReturn(OAuth2TokenType.ACCESS_TOKEN);
        OAuth2AccessToken accessToken =
                new OAuth2AccessToken(
                        OAuth2AccessToken.TokenType.BEARER,
                        "value",
                        Instant.now(),
                        Instant.now().plusSeconds(60));

        generator(ctx -> accessToken).generate(context);

        when(context.getAuthorizationGrantType()).thenReturn(AuthorizationGrantType.REFRESH_TOKEN);
        when(context.getTokenType()).thenReturn(OAuth2TokenType.ACCESS_TOKEN);
        OAuth2RefreshToken refreshToken = new OAuth2RefreshToken("refresh", Instant.now());
        generator(ctx -> refreshToken).generate(context);

        assertThat(
                        registry.get("spring.authorization.server.events")
                                .tag("event", "token_issued")
                                .counter()
                                .count())
                .isEqualTo(1);
        assertThat(
                        registry.get("spring.authorization.server.events")
                                .tag("event", "refresh_token")
                                .counter()
                                .count())
                .isEqualTo(1);
    }

    @Test
    void recordsTokenGenerationFailureAndRethrows() {
        when(context.getAuthorizationGrantType())
                .thenReturn(AuthorizationGrantType.CLIENT_CREDENTIALS);
        when(context.getTokenType()).thenReturn(new OAuth2TokenType("custom"));

        ObservabilityOAuth2TokenGenerator failingGenerator =
                generator(
                        ctx -> {
                            throw new IllegalStateException("failed");
                        });
        assertThatThrownBy(() -> failingGenerator.generate(context))
                .isInstanceOf(IllegalStateException.class);

        assertThat(
                        registry.get("spring.authorization.server.events")
                                .tag("event", "token_issued")
                                .tag("outcome", "failure")
                                .counter()
                                .count())
                .isEqualTo(1);
    }

    private ObservabilityOAuth2TokenGenerator generator(
            OAuth2TokenGenerator<OAuth2Token> delegate) {
        return new ObservabilityOAuth2TokenGenerator(delegate, metrics);
    }
}
