package io.github.susimsek.springauthserversamples.config.security;

import io.github.susimsek.springauthserversamples.security.ClientSecuritySettings;
import io.github.susimsek.springauthserversamples.service.admin.ClientScopeSettings;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Base64;
import java.util.LinkedHashSet;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationException;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2PushedAuthorizationRequestAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.web.authentication.OAuth2AuthorizationCodeRequestAuthenticationConverter;
import org.springframework.security.web.authentication.AuthenticationConverter;

@SuppressWarnings("java:S4449")
public final class DefaultClientScopesAuthorizationRequestConverter
        implements AuthenticationConverter {

    private final OAuth2AuthorizationCodeRequestAuthenticationConverter delegate =
            new OAuth2AuthorizationCodeRequestAuthenticationConverter();
    private final RegisteredClientRepository registeredClientRepository;

    public DefaultClientScopesAuthorizationRequestConverter(
            RegisteredClientRepository registeredClientRepository) {
        this.registeredClientRepository = registeredClientRepository;
    }

    @Override
    public Authentication convert(HttpServletRequest request) {
        Authentication authentication = delegate.convert(request);
        if (authentication instanceof OAuth2PushedAuthorizationRequestAuthenticationToken token) {
            var registeredClient = registeredClientRepository.findByClientId(token.getClientId());
            requireDpopJkt(registeredClient, token.getAdditionalParameters(), token);
            if (registeredClient == null) {
                return token;
            }
            var scopes = new LinkedHashSet<>(token.getScopes());
            scopes.addAll(ClientScopeSettings.defaultScopes(registeredClient));
            if (scopes.equals(token.getScopes())) {
                return token;
            }
            return new OAuth2PushedAuthorizationRequestAuthenticationToken(
                    token.getAuthorizationUri(),
                    token.getClientId(),
                    (Authentication) token.getPrincipal(),
                    token.getRedirectUri(),
                    token.getState(),
                    scopes,
                    token.getAdditionalParameters());
        }
        if (!(authentication instanceof OAuth2AuthorizationCodeRequestAuthenticationToken token)) {
            return authentication;
        }
        var registeredClient = registeredClientRepository.findByClientId(token.getClientId());
        if (registeredClient == null) {
            return token;
        }
        if (!token.getAdditionalParameters().containsKey("request_uri")) {
            requireDpopJkt(registeredClient, token.getAdditionalParameters(), token);
        }
        var scopes = new LinkedHashSet<>(token.getScopes());
        scopes.addAll(ClientScopeSettings.defaultScopes(registeredClient));
        if (scopes.equals(token.getScopes())) {
            return token;
        }
        return new OAuth2AuthorizationCodeRequestAuthenticationToken(
                token.getAuthorizationUri(),
                token.getClientId(),
                (Authentication) token.getPrincipal(),
                token.getRedirectUri(),
                token.getState(),
                scopes,
                token.getAdditionalParameters());
    }

    private static void requireDpopJkt(
            RegisteredClient client,
            java.util.Map<String, Object> parameters,
            Authentication authentication) {
        if (client == null || !ClientSecuritySettings.requiresDpopJkt(client)) {
            return;
        }
        Object dpopJkt = parameters.get("dpop_jkt");
        if (!(dpopJkt instanceof String value) || !isValidDpopJkt(value)) {
            throw new OAuth2AuthorizationCodeRequestAuthenticationException(
                    new OAuth2Error(
                            OAuth2ErrorCodes.INVALID_REQUEST,
                            "OAuth 2.0 Parameter: dpop_jkt",
                            "https://www.rfc-editor.org/rfc/rfc9449#section-10.1"),
                    authentication
                                    instanceof
                                    OAuth2AuthorizationCodeRequestAuthenticationToken token
                            ? token
                            : null);
        }
    }

    private static boolean isValidDpopJkt(String value) {
        try {
            return Base64.getUrlDecoder().decode(value).length == 32;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
}
