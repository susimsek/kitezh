package io.github.susimsek.springauthserversamples.config.security;

import com.nimbusds.jwt.SignedJWT;
import io.github.susimsek.springauthserversamples.security.ClientSecuritySettings;
import io.github.susimsek.springauthserversamples.service.admin.ClientScopeSettings;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.LinkedHashSet;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientCredentialsAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.web.authentication.OAuth2AuthorizationCodeAuthenticationConverter;
import org.springframework.security.oauth2.server.authorization.web.authentication.OAuth2ClientCredentialsAuthenticationConverter;
import org.springframework.security.oauth2.server.authorization.web.authentication.OAuth2DeviceCodeAuthenticationConverter;
import org.springframework.security.oauth2.server.authorization.web.authentication.OAuth2RefreshTokenAuthenticationConverter;
import org.springframework.security.oauth2.server.authorization.web.authentication.OAuth2TokenExchangeAuthenticationConverter;
import org.springframework.security.web.authentication.AuthenticationConverter;
import org.springframework.security.web.authentication.DelegatingAuthenticationConverter;

public final class DefaultClientScopesClientCredentialsConverter
        implements AuthenticationConverter {

    private final AuthenticationConverter delegate =
            new DelegatingAuthenticationConverter(
                    Arrays.asList(
                            new OAuth2AuthorizationCodeAuthenticationConverter(),
                            new OAuth2RefreshTokenAuthenticationConverter(),
                            new OAuth2ClientCredentialsAuthenticationConverter(),
                            new OAuth2DeviceCodeAuthenticationConverter(),
                            new OAuth2TokenExchangeAuthenticationConverter()));

    @Override
    public Authentication convert(HttpServletRequest request) {
        validateDpopAlgorithm(request);
        requireDpopProof(request);
        Authentication authentication = delegate.convert(request);
        if (!(authentication instanceof OAuth2ClientCredentialsAuthenticationToken token)
                || !(token.getPrincipal()
                        instanceof OAuth2ClientAuthenticationToken clientPrincipal)
                || clientPrincipal.getRegisteredClient() == null) {
            return authentication;
        }
        var scopes = new LinkedHashSet<>(token.getScopes());
        scopes.addAll(ClientScopeSettings.defaultScopes(clientPrincipal.getRegisteredClient()));
        if (scopes.equals(token.getScopes())) {
            return token;
        }
        return new OAuth2ClientCredentialsAuthenticationToken(
                clientPrincipal, scopes, token.getAdditionalParameters());
    }

    private static void requireDpopProof(HttpServletRequest request) {
        if (!org.springframework.util.StringUtils.hasText(request.getHeader("DPoP"))) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication instanceof OAuth2ClientAuthenticationToken clientAuthentication) {
                RegisteredClient client = clientAuthentication.getRegisteredClient();
                boolean authorizationCodeGrant =
                        "authorization_code".equals(request.getParameter("grant_type"));
                boolean refreshTokenGrant =
                        "refresh_token".equals(request.getParameter("grant_type"));
                boolean publicClient =
                        client != null
                                && client.getClientAuthenticationMethods()
                                        .contains(ClientAuthenticationMethod.NONE);
                if (client != null
                        && (ClientSecuritySettings.requiresDpopProof(client)
                                || (authorizationCodeGrant
                                        && ClientSecuritySettings.requiresDpopJkt(client))
                                || (refreshTokenGrant
                                        && ClientSecuritySettings.requiresDpopForRefreshToken(
                                                client))
                                || (authorizationCodeGrant
                                        && publicClient
                                        && ClientSecuritySettings.requiresDpopForRefreshToken(
                                                client)))) {
                    throw new OAuth2AuthenticationException(
                            new OAuth2Error(
                                    OAuth2ErrorCodes.INVALID_REQUEST,
                                    "DPoP proof is required for this client",
                                    "https://www.rfc-editor.org/rfc/rfc9449#section-4.2"));
                }
            }
        }
    }

    private static void validateDpopAlgorithm(HttpServletRequest request) {
        String proof = request.getHeader("DPoP");
        if (!org.springframework.util.StringUtils.hasText(proof)) {
            return;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof OAuth2ClientAuthenticationToken clientAuthentication)) {
            return;
        }
        RegisteredClient client = clientAuthentication.getRegisteredClient();
        if (client == null) {
            return;
        }
        String algorithm;
        try {
            algorithm = SignedJWT.parse(proof).getHeader().getAlgorithm().getName();
        } catch (java.text.ParseException exception) {
            throw invalidDpopProof();
        }
        if (!ClientSecuritySettings.allowedDpopSigningAlgorithms(client).contains(algorithm)) {
            throw invalidDpopProof();
        }
    }

    private static OAuth2AuthenticationException invalidDpopProof() {
        return new OAuth2AuthenticationException(
                new OAuth2Error(
                        OAuth2ErrorCodes.INVALID_DPOP_PROOF,
                        "DPoP proof uses a disallowed signature algorithm",
                        "https://www.rfc-editor.org/rfc/rfc9449#section-4.2"));
    }
}
