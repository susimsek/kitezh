package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import io.github.susimsek.kitezh.security.ClientSecuritySettings;
import io.github.susimsek.kitezh.security.OfflineAccessSettings;
import java.security.Principal;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsent;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsentService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AccessTokenAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2TokenExchangeAuthenticationProvider;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2TokenExchangeAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.token.DefaultOAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Applies the single-issuer token exchange policy before Spring's RFC 8693 provider. */
@Component
public final class TokenExchangeAuthenticationProvider implements AuthenticationProvider {

    private static final String REQUESTED_SUBJECT = "requested_subject";
    private static final String INVALID_TARGET = "invalid_target";
    private final OAuth2AuthorizationService authorizationService;
    private final RegisteredClientRepository registeredClientRepository;
    private final OAuth2AuthorizationConsentService authorizationConsentService;
    private final OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator;
    private final OAuth2TokenExchangeAuthenticationProvider delegate;

    @Autowired
    public TokenExchangeAuthenticationProvider(
            OAuth2AuthorizationService authorizationService,
            RegisteredClientRepository registeredClientRepository,
            OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator) {
        this(
                authorizationService,
                registeredClientRepository,
                new NoopAuthorizationConsentService(),
                tokenGenerator);
    }

    public TokenExchangeAuthenticationProvider(
            OAuth2AuthorizationService authorizationService,
            RegisteredClientRepository registeredClientRepository,
            OAuth2AuthorizationConsentService authorizationConsentService,
            OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator) {
        this.authorizationService = authorizationService;
        this.registeredClientRepository = registeredClientRepository;
        this.authorizationConsentService = authorizationConsentService;
        this.tokenGenerator = tokenGenerator;
        this.delegate =
                new OAuth2TokenExchangeAuthenticationProvider(
                        new TokenExchangeAuthorizationService(authorizationService),
                        tokenGenerator);
    }

    @Override
    public Authentication authenticate(Authentication authentication)
            throws AuthenticationException {
        OAuth2TokenExchangeAuthenticationToken token =
                (OAuth2TokenExchangeAuthenticationToken) authentication;
        OAuth2ClientAuthenticationToken clientPrincipal = authenticatedClient(token);
        RegisteredClient client = clientPrincipal.getRegisteredClient();

        if (client == null
                || !client.getAuthorizationGrantTypes()
                        .contains(
                                new AuthorizationGrantType(
                                        AuthorizationGrantTypes.TOKEN_EXCHANGE))) {
            throw new OAuth2AuthenticationException(OAuth2ErrorCodes.UNAUTHORIZED_CLIENT);
        }
        if (client.getClientAuthenticationMethods()
                .contains(
                        org.springframework.security.oauth2.core.ClientAuthenticationMethod.NONE)) {
            throw new OAuth2AuthenticationException(OAuth2ErrorCodes.UNAUTHORIZED_CLIENT);
        }
        validateRequestedSubject(token);
        validateResourceParameters(token);
        validateActorPolicy(token, client);
        OAuth2Authorization subjectAuthorization = findSubjectAuthorization(token);
        validateRequesterAudience(token, client, subjectAuthorization);
        validateAudiencePolicy(token, client);
        validateScopePolicy(token, client, subjectAuthorization);
        validateUserConsent(token, client, subjectAuthorization);
        Authentication result = delegate.authenticate(authentication);
        return enrichExtendedTokenResponse(token, client, subjectAuthorization, result);
    }

    private static OAuth2ClientAuthenticationToken authenticatedClient(
            OAuth2TokenExchangeAuthenticationToken token) {
        if (token.getPrincipal() instanceof OAuth2ClientAuthenticationToken client
                && client.isAuthenticated()) {
            return client;
        }
        throw new OAuth2AuthenticationException(OAuth2ErrorCodes.INVALID_CLIENT);
    }

    private static void validateRequestedSubject(OAuth2TokenExchangeAuthenticationToken token) {
        if (StringUtils.hasText(
                stringParameter(token.getAdditionalParameters().get(REQUESTED_SUBJECT)))) {
            throw error(
                    OAuth2ErrorCodes.INVALID_REQUEST,
                    "requested_subject is not supported by standard token exchange");
        }
    }

    private static void validateResourceParameters(OAuth2TokenExchangeAuthenticationToken token) {
        if (!token.getResources().isEmpty()) {
            throw error(
                    OAuth2ErrorCodes.INVALID_REQUEST,
                    "The resource parameter is not supported by this authorization server");
        }
    }

    private static void validateActorPolicy(
            OAuth2TokenExchangeAuthenticationToken token, RegisteredClient client) {
        if (StringUtils.hasText(token.getActorToken())
                && !ClientSecuritySettings.tokenExchangeAllowsDelegation(client)) {
            throw error(
                    OAuth2ErrorCodes.ACCESS_DENIED,
                    "Token exchange delegation is not enabled for this client");
        }
    }

    private OAuth2Authorization findSubjectAuthorization(
            OAuth2TokenExchangeAuthenticationToken token) {
        OAuth2Authorization authorization =
                authorizationService.findByToken(
                        token.getSubjectToken(), OAuth2TokenType.ACCESS_TOKEN);
        if (authorization == null) {
            throw error(OAuth2ErrorCodes.INVALID_GRANT, "The subject token is invalid");
        }
        return authorization;
    }

    private static void validateRequesterAudience(
            OAuth2TokenExchangeAuthenticationToken token,
            RegisteredClient client,
            OAuth2Authorization subjectAuthorization) {
        if (client.getId().equals(subjectAuthorization.getRegisteredClientId())) {
            return;
        }
        OAuth2Authorization.Token<OAuth2Token> subjectToken =
                subjectAuthorization.getToken(token.getSubjectToken());
        if (subjectToken == null || !hasAudience(subjectToken.getClaims(), client.getClientId())) {
            throw error(
                    OAuth2ErrorCodes.ACCESS_DENIED,
                    "The subject token is not intended for the requesting client");
        }
    }

    private void validateAudiencePolicy(
            OAuth2TokenExchangeAuthenticationToken token, RegisteredClient client) {
        Set<String> requestedAudiences = token.getAudiences();
        if (requestedAudiences.isEmpty()) {
            return;
        }
        Set<String> allowedAudiences = ClientSecuritySettings.tokenExchangeAllowedAudiences(client);
        for (String audience : requestedAudiences) {
            RegisteredClient target = registeredClientRepository.findByClientId(audience);
            if (target == null
                    || !ClientSecuritySettings.isEnabled(target)
                    || !target.getAuthorizationGrantTypes()
                            .contains(
                                    new AuthorizationGrantType(
                                            AuthorizationGrantTypes.TOKEN_EXCHANGE))
                    || (!audience.equals(client.getClientId())
                            && !allowedAudiences.contains(audience))) {
                throw error(INVALID_TARGET, "The requested audience is not allowed");
            }
        }
    }

    private void validateUserConsent(
            OAuth2TokenExchangeAuthenticationToken token,
            RegisteredClient client,
            OAuth2Authorization subjectAuthorization) {
        if (!requiresUserConsent(subjectAuthorization)
                || !client.getClientSettings().isRequireAuthorizationConsent()) {
            return;
        }
        OAuth2AuthorizationConsent consent =
                authorizationConsentService.findById(
                        client.getId(), subjectAuthorization.getPrincipalName());
        Set<String> requiredScopes =
                token.getScopes().isEmpty()
                        ? subjectAuthorization.getAuthorizedScopes()
                        : token.getScopes();
        if (consent == null || !consent.getScopes().containsAll(requiredScopes)) {
            throw error(
                    OAuth2ErrorCodes.ACCESS_DENIED, "User consent is required for token exchange");
        }
    }

    private static boolean requiresUserConsent(OAuth2Authorization authorization) {
        String grantType = authorization.getAuthorizationGrantType().getValue();
        return AuthorizationGrantType.AUTHORIZATION_CODE.getValue().equals(grantType)
                || AuthorizationGrantTypes.CIBA.equals(grantType);
    }

    private Authentication enrichExtendedTokenResponse(
            OAuth2TokenExchangeAuthenticationToken token,
            RegisteredClient client,
            OAuth2Authorization subjectAuthorization,
            Authentication authentication) {
        if (!(authentication
                instanceof OAuth2AccessTokenAuthenticationToken accessAuthentication)) {
            return authentication;
        }
        String requestedTokenType = token.getRequestedTokenType();
        boolean refreshRequested =
                TokenExchangeAuthenticationConverter.REFRESH_TOKEN_TYPE.equals(requestedTokenType);
        boolean idTokenRequested =
                TokenExchangeAuthenticationConverter.ID_TOKEN_TYPE.equals(requestedTokenType);
        if (!refreshRequested && !idTokenRequested) {
            return authentication;
        }
        if (refreshRequested
                && !client.getAuthorizationGrantTypes()
                        .contains(AuthorizationGrantType.REFRESH_TOKEN)) {
            throw error(
                    OAuth2ErrorCodes.UNAUTHORIZED_CLIENT,
                    "The client is not allowed to receive refresh tokens");
        }
        OAuth2Authorization authorization =
                authorizationService.findByToken(
                        accessAuthentication.getAccessToken().getTokenValue(),
                        OAuth2TokenType.ACCESS_TOKEN);
        if (authorization == null) {
            throw error(OAuth2ErrorCodes.SERVER_ERROR, "The exchanged authorization was not saved");
        }
        OAuth2Authorization.Builder builder =
                OAuth2Authorization.from(authorization)
                        .authorizedScopes(
                                refreshScopes(
                                        authorization.getAuthorizedScopes(),
                                        subjectAuthorization,
                                        refreshRequested,
                                        idTokenRequested))
                        .attributes(
                                attributes -> {
                                    Map<String, Object> sourceAttributes =
                                            subjectAuthorization.getAttributes();
                                    Object startedAt =
                                            sourceAttributes.get(
                                                    OfflineAccessSettings.SESSION_STARTED_AT);
                                    if (startedAt != null) {
                                        attributes.put(
                                                OfflineAccessSettings.SESSION_STARTED_AT,
                                                startedAt);
                                    }
                                    attributes.put(
                                            ClientSecuritySettings
                                                    .TOKEN_EXCHANGE_SOURCE_AUTHORIZATION_ID,
                                            subjectAuthorization.getId());
                                });
        OAuth2Authorization preparedAuthorization = builder.build();
        OAuth2RefreshToken refreshToken =
                refreshRequested
                        ? generateRefreshToken(
                                client,
                                preparedAuthorization,
                                principal(preparedAuthorization),
                                preparedAuthorization.getAuthorizedScopes(),
                                token)
                        : null;
        OidcIdToken idToken =
                idTokenRequested
                        ? generateIdToken(
                                client,
                                preparedAuthorization,
                                principal(preparedAuthorization),
                                preparedAuthorization.getAuthorizedScopes(),
                                token)
                        : null;
        if (refreshToken != null) {
            builder.refreshToken(refreshToken);
        }
        if (idToken != null) {
            builder.token(
                    idToken,
                    metadata ->
                            metadata.put(
                                    OAuth2Authorization.Token.CLAIMS_METADATA_NAME,
                                    idToken.getClaims()));
        }
        OAuth2Authorization enriched = builder.build();
        authorizationService.save(enriched);
        Map<String, Object> additionalParameters =
                new HashMap<>(accessAuthentication.getAdditionalParameters());
        if (idToken != null) {
            additionalParameters.put(OidcParameterNames.ID_TOKEN, idToken.getTokenValue());
        }
        if (!(accessAuthentication.getPrincipal() instanceof Authentication principal)) {
            throw error(OAuth2ErrorCodes.SERVER_ERROR, "The exchanged principal is unavailable");
        }
        return new OAuth2AccessTokenAuthenticationToken(
                client,
                principal,
                accessAuthentication.getAccessToken(),
                refreshToken,
                additionalParameters);
    }

    private static Set<String> refreshScopes(
            Set<String> authorizedScopes,
            OAuth2Authorization subjectAuthorization,
            boolean refreshRequested,
            boolean idTokenRequested) {
        if (!refreshRequested
                || idTokenRequested
                || subjectAuthorization.getToken(OidcIdToken.class) != null) {
            return authorizedScopes;
        }
        Set<String> scopes = new LinkedHashSet<>(authorizedScopes);
        scopes.remove(OidcScopes.OPENID);
        return scopes;
    }

    private OAuth2RefreshToken generateRefreshToken(
            RegisteredClient client,
            OAuth2Authorization authorization,
            Authentication principal,
            Set<String> authorizedScopes,
            OAuth2TokenExchangeAuthenticationToken grant) {
        OAuth2TokenContext context =
                DefaultOAuth2TokenContext.builder()
                        .registeredClient(client)
                        .authorization(authorization)
                        .principal(principal)
                        .authorizationServerContext(AuthorizationServerContextHolder.getContext())
                        .authorizedScopes(authorizedScopes)
                        .tokenType(OAuth2TokenType.REFRESH_TOKEN)
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.TOKEN_EXCHANGE))
                        .authorizationGrant(grant)
                        .build();
        OAuth2Token generated = tokenGenerator().generate(context);
        if (!(generated instanceof OAuth2RefreshToken refreshToken)) {
            throw error(
                    OAuth2ErrorCodes.SERVER_ERROR,
                    "The token generator failed to generate the refresh token");
        }
        return refreshToken;
    }

    private OidcIdToken generateIdToken(
            RegisteredClient client,
            OAuth2Authorization authorization,
            Authentication principal,
            Set<String> authorizedScopes,
            OAuth2TokenExchangeAuthenticationToken grant) {
        if (!authorizedScopes.contains(OidcScopes.OPENID)) {
            throw error(
                    OAuth2ErrorCodes.INVALID_SCOPE, "The openid scope is required for an ID token");
        }
        OAuth2TokenContext context =
                DefaultOAuth2TokenContext.builder()
                        .registeredClient(client)
                        .authorization(authorization)
                        .principal(principal)
                        .authorizationServerContext(AuthorizationServerContextHolder.getContext())
                        .authorizedScopes(authorizedScopes)
                        .tokenType(new OAuth2TokenType(OidcParameterNames.ID_TOKEN))
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.TOKEN_EXCHANGE))
                        .authorizationGrant(grant)
                        .build();
        OAuth2Token generated = tokenGenerator().generate(context);
        if (!(generated instanceof org.springframework.security.oauth2.jwt.Jwt jwt)) {
            throw error(
                    OAuth2ErrorCodes.SERVER_ERROR,
                    "The token generator failed to generate the ID token");
        }
        return new OidcIdToken(
                jwt.getTokenValue(), jwt.getIssuedAt(), jwt.getExpiresAt(), jwt.getClaims());
    }

    private static Authentication principal(OAuth2Authorization authorization) {
        Object principal = authorization.getAttribute(Principal.class.getName());
        if (principal instanceof Authentication authentication) {
            return authentication;
        }
        throw error(OAuth2ErrorCodes.SERVER_ERROR, "The exchanged authorization has no principal");
    }

    private OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator() {
        return tokenGenerator;
    }

    private static void validateScopePolicy(
            OAuth2TokenExchangeAuthenticationToken token,
            RegisteredClient client,
            OAuth2Authorization subjectAuthorization) {
        if (!ClientSecuritySettings.tokenExchangeDownscopeOnly(client)) {
            return;
        }
        Set<String> subjectScopes = subjectAuthorization.getAuthorizedScopes();
        if (!subjectScopes.containsAll(token.getScopes())) {
            throw error(
                    OAuth2ErrorCodes.INVALID_SCOPE,
                    "The requested scopes exceed the subject token scopes");
        }
    }

    private static boolean hasAudience(java.util.Map<String, Object> claims, String audience) {
        if (claims == null) {
            return false;
        }
        Object value = claims.get("aud");
        if (value instanceof String single) {
            return audience.equals(single);
        }
        return value instanceof Collection<?> values && values.contains(audience);
    }

    private static String stringParameter(Object value) {
        return value instanceof String string ? string : null;
    }

    private static OAuth2AuthenticationException error(String code, String description) {
        return new OAuth2AuthenticationException(new OAuth2Error(code, description, null));
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return OAuth2TokenExchangeAuthenticationToken.class.isAssignableFrom(authentication);
    }

    private static final class TokenExchangeAuthorizationService
            implements OAuth2AuthorizationService {

        private final OAuth2AuthorizationService delegate;

        private TokenExchangeAuthorizationService(OAuth2AuthorizationService delegate) {
            this.delegate = delegate;
        }

        @Override
        public void save(OAuth2Authorization authorization) {
            delegate.save(authorization);
        }

        @Override
        public void remove(OAuth2Authorization authorization) {
            delegate.remove(authorization);
        }

        @Override
        public OAuth2Authorization findById(String id) {
            return delegate.findById(id);
        }

        @Override
        public OAuth2Authorization findByToken(String token, OAuth2TokenType tokenType) {
            OAuth2Authorization authorization = delegate.findByToken(token, tokenType);
            if (authorization == null
                    || authorization.getAttribute(Principal.class.getName()) != null) {
                return authorization;
            }
            return OAuth2Authorization.from(authorization)
                    .attribute(
                            Principal.class.getName(),
                            UsernamePasswordAuthenticationToken.authenticated(
                                    authorization.getPrincipalName(), null, List.of()))
                    .build();
        }
    }

    private static final class NoopAuthorizationConsentService
            implements OAuth2AuthorizationConsentService {

        @Override
        public OAuth2AuthorizationConsent findById(
                String registeredClientId, String principalName) {
            return null;
        }

        @Override
        public void save(OAuth2AuthorizationConsent authorizationConsent) {
            throw new UnsupportedOperationException("Consent persistence is unavailable");
        }

        @Override
        public void remove(OAuth2AuthorizationConsent authorizationConsent) {
            throw new UnsupportedOperationException("Consent persistence is unavailable");
        }
    }
}
