package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;
import org.springframework.security.oauth2.jwt.Jwt;

class MicrosoftOidcIdTokenValidatorTest {

    private static final String CLIENT_ID = "microsoft-client";
    private static final Instant ISSUED_AT = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant EXPIRES_AT = Instant.parse("2030-01-01T00:00:00Z");

    @Test
    void acceptsTenantSpecificMicrosoftIssuer() {
        assertThat(validator().validate(token("tenant-id")).hasErrors()).isFalse();
    }

    @Test
    void rejectsNonMicrosoftIssuer() {
        assertThat(validator().validate(token("common")).hasErrors()).isTrue();
    }

    @Test
    void rejectsInvalidIssuerShapesAndReservedTenants() {
        assertThat(validator().validate(tokenWithIssuer("https://example.test/v2.0")).hasErrors())
                .isTrue();
        assertThat(
                        validator()
                                .validate(
                                        tokenWithIssuer("https://login.microsoftonline.com/tenant"))
                                .hasErrors())
                .isTrue();
        assertThat(
                        validator()
                                .validate(
                                        tokenWithIssuer("https://login.microsoftonline.com//v2.0"))
                                .hasErrors())
                .isTrue();
        assertThat(
                        validator()
                                .validate(
                                        tokenWithIssuer(
                                                "https://login.microsoftonline.com/tenant/child/v2.0"))
                                .hasErrors())
                .isTrue();
        for (String tenant : List.of("ORGANIZATIONS", "CONSUMERS")) {
            assertThat(validator().validate(token(tenant)).hasErrors()).isTrue();
        }
    }

    @Test
    void rejectsMissingAndInconsistentIdTokenClaims() {
        assertThat(validator().validate(tokenWithoutSubject()).hasErrors()).isTrue();
        assertThat(validator().validate(tokenWithoutAudience()).hasErrors()).isTrue();
        assertThat(validator().validate(tokenWithAudience(List.of("other"), null)).hasErrors())
                .isTrue();
        assertThat(
                        validator()
                                .validate(tokenWithAudience(List.of(CLIENT_ID, "other"), null))
                                .hasErrors())
                .isTrue();
        assertThat(
                        validator()
                                .validate(tokenWithAudience(List.of(CLIENT_ID), "different-client"))
                                .hasErrors())
                .isTrue();
        assertThat(validator().validate(tokenWithoutExpiry()).hasErrors()).isTrue();
        assertThat(validator().validate(tokenWithoutIssuedAt()).hasErrors()).isTrue();
    }

    private static MicrosoftOidcIdTokenValidator validator() {
        return new MicrosoftOidcIdTokenValidator(
                ClientRegistration.withRegistrationId("microsoft")
                        .clientId(CLIENT_ID)
                        .clientSecret("secret")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .authorizationUri("https://login.microsoftonline.com/common/authorize")
                        .tokenUri("https://login.microsoftonline.com/common/token")
                        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                        .build());
    }

    private static Jwt token(String tenant) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim(
                        IdTokenClaimNames.ISS,
                        "https://login.microsoftonline.com/" + tenant + "/v2.0")
                .claim(IdTokenClaimNames.SUB, "subject")
                .claim(IdTokenClaimNames.AUD, CLIENT_ID)
                .issuedAt(ISSUED_AT)
                .expiresAt(EXPIRES_AT)
                .build();
    }

    private static Jwt tokenWithIssuer(String issuer) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim(IdTokenClaimNames.ISS, issuer)
                .claim(IdTokenClaimNames.SUB, "subject")
                .claim(IdTokenClaimNames.AUD, CLIENT_ID)
                .issuedAt(ISSUED_AT)
                .expiresAt(EXPIRES_AT)
                .build();
    }

    private static Jwt tokenWithoutSubject() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim(IdTokenClaimNames.ISS, "https://login.microsoftonline.com/tenant/v2.0")
                .claim(IdTokenClaimNames.AUD, CLIENT_ID)
                .issuedAt(ISSUED_AT)
                .expiresAt(EXPIRES_AT)
                .build();
    }

    private static Jwt tokenWithoutAudience() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim(IdTokenClaimNames.ISS, "https://login.microsoftonline.com/tenant/v2.0")
                .claim(IdTokenClaimNames.SUB, "subject")
                .issuedAt(ISSUED_AT)
                .expiresAt(EXPIRES_AT)
                .build();
    }

    private static Jwt tokenWithAudience(List<String> audience, String authorizedParty) {
        Jwt.Builder builder =
                Jwt.withTokenValue("token")
                        .header("alg", "RS256")
                        .claim(
                                IdTokenClaimNames.ISS,
                                "https://login.microsoftonline.com/tenant/v2.0")
                        .claim(IdTokenClaimNames.SUB, "subject")
                        .claim(IdTokenClaimNames.AUD, audience)
                        .issuedAt(ISSUED_AT)
                        .expiresAt(EXPIRES_AT);
        if (authorizedParty != null) {
            builder.claim(IdTokenClaimNames.AZP, authorizedParty);
        }
        return builder.build();
    }

    private static Jwt tokenWithoutExpiry() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim(IdTokenClaimNames.ISS, "https://login.microsoftonline.com/tenant/v2.0")
                .claim(IdTokenClaimNames.SUB, "subject")
                .claim(IdTokenClaimNames.AUD, CLIENT_ID)
                .issuedAt(ISSUED_AT)
                .build();
    }

    private static Jwt tokenWithoutIssuedAt() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim(IdTokenClaimNames.ISS, "https://login.microsoftonline.com/tenant/v2.0")
                .claim(IdTokenClaimNames.SUB, "subject")
                .claim(IdTokenClaimNames.AUD, CLIENT_ID)
                .expiresAt(EXPIRES_AT)
                .build();
    }
}
