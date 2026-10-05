package io.github.susimsek.kitezh.config.security;

import java.net.URL;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;
import org.springframework.security.oauth2.jwt.Jwt;

/** Validates Microsoft multi-tenant OIDC issuer and standard ID-token claims. */
final class MicrosoftOidcIdTokenValidator implements OAuth2TokenValidator<Jwt> {

    private static final String ISSUER_PREFIX = "https://login.microsoftonline.com/";
    private final ClientRegistration clientRegistration;

    MicrosoftOidcIdTokenValidator(ClientRegistration clientRegistration) {
        this.clientRegistration = clientRegistration;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt idToken) {
        Map<String, Object> invalidClaims = new LinkedHashMap<>();
        URL issuer = idToken.getIssuer();
        if (issuer == null || !isMicrosoftIssuer(issuer.toExternalForm())) {
            invalidClaims.put(IdTokenClaimNames.ISS, issuer);
        }
        if (idToken.getSubject() == null) {
            invalidClaims.put(IdTokenClaimNames.SUB, null);
        }
        List<String> audience = idToken.getAudience();
        if (audience == null || !audience.contains(clientRegistration.getClientId())) {
            invalidClaims.put(IdTokenClaimNames.AUD, audience);
        }
        String authorizedParty = idToken.getClaimAsString(IdTokenClaimNames.AZP);
        if (audience != null && audience.size() > 1 && authorizedParty == null) {
            invalidClaims.put(IdTokenClaimNames.AZP, null);
        }
        if (authorizedParty != null && !authorizedParty.equals(clientRegistration.getClientId())) {
            invalidClaims.put(IdTokenClaimNames.AZP, authorizedParty);
        }
        if (idToken.getExpiresAt() == null) {
            invalidClaims.put(IdTokenClaimNames.EXP, null);
        }
        if (idToken.getIssuedAt() == null) {
            invalidClaims.put(IdTokenClaimNames.IAT, null);
        }
        if (invalidClaims.isEmpty()) {
            return OAuth2TokenValidatorResult.success();
        }
        return OAuth2TokenValidatorResult.failure(
                new OAuth2Error(
                        "invalid_id_token",
                        "The Microsoft ID Token contains invalid claims: " + invalidClaims,
                        "https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc"));
    }

    private static boolean isMicrosoftIssuer(String issuer) {
        if (!issuer.startsWith(ISSUER_PREFIX) || !issuer.endsWith("/v2.0")) {
            return false;
        }
        String tenant =
                issuer.substring(ISSUER_PREFIX.length(), issuer.length() - "/v2.0".length());
        String normalizedTenant = tenant.toLowerCase(Locale.ROOT);
        return !tenant.isBlank()
                && !tenant.contains("/")
                && !normalizedTenant.equals("common")
                && !normalizedTenant.equals("organizations")
                && !normalizedTenant.equals("consumers");
    }
}
