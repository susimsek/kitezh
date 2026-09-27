package io.github.susimsek.springauthserversamples.config.security;

import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestEntity;
import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import io.github.susimsek.springauthserversamples.service.ciba.CibaAuthenticationService;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClaimAccessor;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AccessTokenAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.token.DefaultOAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.Assert;

/** Issues the OIDC CIBA token response after the request has been approved. */
@Component
public class CibaAuthenticationGrantAuthenticationProvider implements AuthenticationProvider {

    private static final AuthorizationGrantType CIBA_GRANT_TYPE =
            new AuthorizationGrantType(AuthorizationGrantTypes.CIBA);

    private final OAuth2AuthorizationService authorizationService;
    private final OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator;
    private final CibaAuthenticationService cibaAuthenticationService;
    private final UserDetailsService userDetailsService;

    public CibaAuthenticationGrantAuthenticationProvider(
            OAuth2AuthorizationService authorizationService,
            OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator,
            CibaAuthenticationService cibaAuthenticationService,
            UserDetailsService userDetailsService) {
        Assert.notNull(authorizationService, "authorizationService cannot be null");
        Assert.notNull(tokenGenerator, "tokenGenerator cannot be null");
        Assert.notNull(cibaAuthenticationService, "cibaAuthenticationService cannot be null");
        Assert.notNull(userDetailsService, "userDetailsService cannot be null");
        this.authorizationService = authorizationService;
        this.tokenGenerator = tokenGenerator;
        this.cibaAuthenticationService = cibaAuthenticationService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    @Transactional
    public Authentication authenticate(Authentication authentication)
            throws AuthenticationException {
        CibaAuthenticationGrantAuthenticationToken grant =
                (CibaAuthenticationGrantAuthenticationToken) authentication;
        OAuth2ClientAuthenticationToken clientPrincipal =
                getAuthenticatedClientElseThrowInvalidClient(grant);
        RegisteredClient registeredClient = clientPrincipal.getRegisteredClient();
        if (!registeredClient.getAuthorizationGrantTypes().contains(CIBA_GRANT_TYPE)) {
            throw new OAuth2AuthenticationException(OAuth2ErrorCodes.UNAUTHORIZED_CLIENT);
        }

        CibaAuthenticationRequestEntity request =
                cibaAuthenticationService.poll(grant.getAuthReqId(), registeredClient.getId());
        UserDetails user = userDetailsService.loadUserByUsername(request.getPrincipalName());
        Set<String> authorizedScopes =
                Arrays.stream(request.getAuthorizedScopes().split(" "))
                        .filter(scope -> !scope.isBlank())
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        Authentication userPrincipal =
                UsernamePasswordAuthenticationToken.authenticated(
                        user.getUsername(), null, user.getAuthorities());
        CibaAuthenticationGrantAuthenticationToken tokenGrant =
                new CibaAuthenticationGrantAuthenticationToken(
                        grant.getAuthReqId(),
                        clientPrincipal,
                        Map.of(
                                CibaAuthenticationGrantAuthenticationToken.ACR_VALUES_ATTRIBUTE,
                                request.getAcrValues() == null ? "" : request.getAcrValues()));
        OAuth2TokenContext tokenContext =
                DefaultOAuth2TokenContext.builder()
                        .registeredClient(registeredClient)
                        .principal(userPrincipal)
                        .authorizationServerContext(AuthorizationServerContextHolder.getContext())
                        .authorizedScopes(authorizedScopes)
                        .tokenType(OAuth2TokenType.ACCESS_TOKEN)
                        .authorizationGrantType(CIBA_GRANT_TYPE)
                        .authorizationGrant(tokenGrant)
                        .build();

        OAuth2Token generatedAccessToken = tokenGenerator.generate(tokenContext);
        if (generatedAccessToken == null) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error(
                            OAuth2ErrorCodes.SERVER_ERROR,
                            "The token generator failed to generate the access token",
                            null));
        }
        OAuth2AccessToken accessToken =
                generatedAccessToken instanceof OAuth2AccessToken token
                        ? token
                        : new OAuth2AccessToken(
                                OAuth2AccessToken.TokenType.BEARER,
                                generatedAccessToken.getTokenValue(),
                                generatedAccessToken.getIssuedAt(),
                                generatedAccessToken.getExpiresAt(),
                                authorizedScopes);
        OAuth2RefreshToken refreshToken =
                authorizedScopes.contains("offline_access")
                                && registeredClient
                                        .getAuthorizationGrantTypes()
                                        .contains(AuthorizationGrantType.REFRESH_TOKEN)
                        ? generateRefreshToken(
                                registeredClient, userPrincipal, authorizedScopes, tokenGrant)
                        : null;
        CibaAuthenticationGrantAuthenticationToken idTokenGrant =
                new CibaAuthenticationGrantAuthenticationToken(
                        grant.getAuthReqId(),
                        clientPrincipal,
                        Map.of(
                                CibaAuthenticationGrantAuthenticationToken.ACR_VALUES_ATTRIBUTE,
                                request.getAcrValues() == null ? "" : request.getAcrValues(),
                                CibaAuthenticationGrantAuthenticationToken.ACCESS_TOKEN_VALUE,
                                accessToken.getTokenValue(),
                                CibaAuthenticationGrantAuthenticationToken.REFRESH_TOKEN_VALUE,
                                refreshToken == null ? "" : refreshToken.getTokenValue()));
        OidcIdToken idToken =
                generateIdToken(registeredClient, userPrincipal, authorizedScopes, idTokenGrant);
        OAuth2Authorization.Builder authorizationBuilder =
                OAuth2Authorization.withRegisteredClient(registeredClient)
                        .principalName(user.getUsername())
                        .authorizationGrantType(CIBA_GRANT_TYPE)
                        .authorizedScopes(authorizedScopes)
                        .attribute(
                                CibaAuthenticationGrantAuthenticationToken.AUTH_REQ_ID_ATTRIBUTE,
                                grant.getAuthReqId())
                        .token(
                                accessToken,
                                metadata -> {
                                    if (generatedAccessToken
                                            instanceof ClaimAccessor claimAccessor) {
                                        metadata.put(
                                                OAuth2Authorization.Token.CLAIMS_METADATA_NAME,
                                                claimAccessor.getClaims());
                                    }
                                })
                        .token(
                                idToken,
                                metadata ->
                                        metadata.put(
                                                OAuth2Authorization.Token.CLAIMS_METADATA_NAME,
                                                idToken.getClaims()));
        if (refreshToken != null) {
            authorizationBuilder.refreshToken(refreshToken);
        }
        OAuth2Authorization authorization = authorizationBuilder.build();
        authorizationService.save(authorization);
        cibaAuthenticationService.consume(request);
        Map<String, Object> additionalParameters = new HashMap<>();
        additionalParameters.put(OidcParameterNames.ID_TOKEN, idToken.getTokenValue());
        return new OAuth2AccessTokenAuthenticationToken(
                registeredClient, clientPrincipal, accessToken, refreshToken, additionalParameters);
    }

    private OidcIdToken generateIdToken(
            RegisteredClient registeredClient,
            Authentication userPrincipal,
            Set<String> authorizedScopes,
            CibaAuthenticationGrantAuthenticationToken grant) {
        OAuth2TokenContext idTokenContext =
                DefaultOAuth2TokenContext.builder()
                        .registeredClient(registeredClient)
                        .principal(userPrincipal)
                        .authorizationServerContext(AuthorizationServerContextHolder.getContext())
                        .authorizedScopes(authorizedScopes)
                        .tokenType(new OAuth2TokenType(OidcParameterNames.ID_TOKEN))
                        .authorizationGrantType(CIBA_GRANT_TYPE)
                        .authorizationGrant(grant)
                        .build();
        OAuth2Token generatedIdToken = tokenGenerator.generate(idTokenContext);
        if (!(generatedIdToken instanceof org.springframework.security.oauth2.jwt.Jwt jwt)) {
            throw serverError("The token generator failed to generate the ID token");
        }
        return new OidcIdToken(
                jwt.getTokenValue(), jwt.getIssuedAt(), jwt.getExpiresAt(), jwt.getClaims());
    }

    private OAuth2RefreshToken generateRefreshToken(
            RegisteredClient registeredClient,
            Authentication userPrincipal,
            Set<String> authorizedScopes,
            CibaAuthenticationGrantAuthenticationToken grant) {
        OAuth2TokenContext refreshTokenContext =
                DefaultOAuth2TokenContext.builder()
                        .registeredClient(registeredClient)
                        .principal(userPrincipal)
                        .authorizationServerContext(AuthorizationServerContextHolder.getContext())
                        .authorizedScopes(authorizedScopes)
                        .tokenType(OAuth2TokenType.REFRESH_TOKEN)
                        .authorizationGrantType(CIBA_GRANT_TYPE)
                        .authorizationGrant(grant)
                        .build();
        OAuth2Token generatedRefreshToken = tokenGenerator.generate(refreshTokenContext);
        if (!(generatedRefreshToken instanceof OAuth2RefreshToken refreshToken)) {
            throw serverError("The token generator failed to generate the refresh token");
        }
        return refreshToken;
    }

    private static OAuth2AuthenticationException serverError(String message) {
        return new OAuth2AuthenticationException(
                new OAuth2Error(OAuth2ErrorCodes.SERVER_ERROR, message, null));
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return CibaAuthenticationGrantAuthenticationToken.class.isAssignableFrom(authentication);
    }

    private static OAuth2ClientAuthenticationToken getAuthenticatedClientElseThrowInvalidClient(
            Authentication authentication) {
        if (authentication.getPrincipal() instanceof OAuth2ClientAuthenticationToken client
                && client.isAuthenticated()) {
            return client;
        }
        throw new OAuth2AuthenticationException(OAuth2ErrorCodes.INVALID_CLIENT);
    }
}
