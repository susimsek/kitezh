package io.github.susimsek.springauthserversamples.config.security;

import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import java.util.Collection;
import java.util.Set;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

final class ConsoleJwtDecoderFactory {

    private ConsoleJwtDecoderFactory() {}

    static JwtDecoder create(
            JWKSource<SecurityContext> jwkSource,
            String issuer,
            String audience,
            AuthorizationRepository authorizationRepository) {
        return create(jwkSource, issuer, Set.of(audience), authorizationRepository);
    }

    static JwtDecoder create(
            JWKSource<SecurityContext> jwkSource,
            String issuer,
            Collection<String> audiences,
            AuthorizationRepository authorizationRepository) {
        NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder.withJwkSource(jwkSource).build();
        OAuth2TokenValidator<Jwt> audienceValidator =
                jwt ->
                        jwt.getAudience().stream().anyMatch(audiences::contains)
                                ? OAuth2TokenValidatorResult.success()
                                : OAuth2TokenValidatorResult.failure(
                                        new OAuth2Error(
                                                "invalid_token", "Invalid token audience", null));
        jwtDecoder.setJwtValidator(
                new DelegatingOAuth2TokenValidator<>(
                        JwtValidators.createDefaultWithIssuer(issuer),
                        audienceValidator,
                        new ActiveAuthorizationTokenValidator(authorizationRepository)));
        return jwtDecoder;
    }
}
