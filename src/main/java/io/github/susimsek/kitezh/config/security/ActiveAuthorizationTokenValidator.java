package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

@RequiredArgsConstructor
final class ActiveAuthorizationTokenValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error INVALID_TOKEN =
            new OAuth2Error("invalid_token", "The authorization is no longer active", null);

    private final AuthorizationRepository authorizationRepository;

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        return authorizationRepository.existsByAccessTokenValue(token.getTokenValue())
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(INVALID_TOKEN);
    }
}
