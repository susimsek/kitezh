package io.github.susimsek.springauthserversamples.config.security;

import io.github.susimsek.springauthserversamples.service.security.OAuth2ObservabilityMetrics;
import org.springframework.lang.Nullable;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

/** Records token grant outcomes without exposing token values or user identifiers. */
final class ObservabilityOAuth2TokenGenerator implements OAuth2TokenGenerator<OAuth2Token> {

    private static final String TOKEN_GENERATION_FAILED = "token_generation_failed";

    private final OAuth2TokenGenerator<OAuth2Token> delegate;
    private final OAuth2ObservabilityMetrics metrics;

    ObservabilityOAuth2TokenGenerator(
            OAuth2TokenGenerator<OAuth2Token> delegate, OAuth2ObservabilityMetrics metrics) {
        this.delegate = delegate;
        this.metrics = metrics;
    }

    @Override
    @Nullable
    public OAuth2Token generate(OAuth2TokenContext context) {
        String grantType = context.getAuthorizationGrantType().getValue();
        String clientId = clientId(context);
        try {
            OAuth2Token token = delegate.generate(context);
            if (token != null) {
                metrics.recordToken(
                        event(token, grantType),
                        "success",
                        null,
                        grantType,
                        tokenType(token, context),
                        clientId);
            }
            return token;
        } catch (RuntimeException exception) {
            metrics.recordToken(
                    event(null, grantType),
                    "failure",
                    TOKEN_GENERATION_FAILED,
                    grantType,
                    tokenType(null, context),
                    clientId);
            throw exception;
        }
    }

    private static String event(@Nullable OAuth2Token token, @Nullable String grantType) {
        if (OAuth2TokenType.REFRESH_TOKEN.getValue().equals(grantType)
                || token instanceof OAuth2RefreshToken) {
            return "refresh_token";
        }
        return "token_issued";
    }

    @Nullable
    private static String clientId(OAuth2TokenContext context) {
        var registeredClient = context.getRegisteredClient();
        return registeredClient == null ? null : registeredClient.getClientId();
    }

    private static String tokenType(@Nullable OAuth2Token token, OAuth2TokenContext context) {
        if (token instanceof OAuth2AccessToken) {
            return "access_token";
        }
        if (token instanceof OAuth2RefreshToken) {
            return "refresh_token";
        }
        return context.getTokenType().getValue();
    }
}
