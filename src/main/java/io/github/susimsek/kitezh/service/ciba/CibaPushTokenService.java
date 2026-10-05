package io.github.susimsek.kitezh.service.ciba;

import io.github.susimsek.kitezh.config.security.CibaAuthenticationGrantAuthenticationToken;
import io.github.susimsek.kitezh.domain.CibaAuthenticationRequestEntity;
import io.github.susimsek.kitezh.domain.CibaAuthenticationRequestStatus;
import io.github.susimsek.kitezh.repository.CibaAuthenticationRequestRepository;
import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import java.time.Duration;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClaimAccessor;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContext;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.DefaultOAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Generates and delivers the final token response for CIBA push-mode requests. */
@Service
@RequiredArgsConstructor
public class CibaPushTokenService {

    private static final String SERVER_ERROR = "server_error";

    private static final AuthorizationGrantType CIBA_GRANT_TYPE =
            new AuthorizationGrantType(AuthorizationGrantTypes.CIBA);

    private final CibaAuthenticationRequestRepository requestRepository;
    private final RegisteredClientRepository clientRepository;
    private final UserDetailsService userDetailsService;
    private final OAuth2AuthorizationService authorizationService;
    private final OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator;
    private final CibaNotificationService notificationService;
    private final AuthorizationServerSettings authorizationServerSettings;

    @Transactional
    public void issue(CibaAuthenticationRequestEntity request) {
        if (request.getStatus() != CibaAuthenticationRequestStatus.APPROVED) {
            return;
        }
        RegisteredClient client = clientRepository.findById(request.getRegisteredClientId());
        if (client == null) {
            throw protocol("invalid_request", "The registered CIBA client no longer exists");
        }
        UserDetails user = userDetailsService.loadUserByUsername(request.getPrincipalName());
        Set<String> scopes = authorizedScopes(request);
        OAuth2ClientAuthenticationToken clientPrincipal =
                new OAuth2ClientAuthenticationToken(
                        client, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, null);
        CibaAuthenticationGrantAuthenticationToken grant =
                new CibaAuthenticationGrantAuthenticationToken(
                        request.getAuthReqId(),
                        clientPrincipal,
                        Map.of(
                                CibaAuthenticationGrantAuthenticationToken.ACR_VALUES_ATTRIBUTE,
                                request.getAcrValues() == null ? "" : request.getAcrValues()));
        Authentication userPrincipal =
                UsernamePasswordAuthenticationToken.authenticated(
                        user.getUsername(), null, user.getAuthorities());
        AuthorizationServerContext context = currentContext();
        OAuth2AccessToken accessToken = accessToken(client, userPrincipal, scopes, grant, context);
        final OAuth2RefreshToken refreshToken =
                scopes.contains("offline_access")
                                && client.getAuthorizationGrantTypes()
                                        .contains(AuthorizationGrantType.REFRESH_TOKEN)
                        ? refreshToken(client, userPrincipal, scopes, grant, context)
                        : null;
        CibaAuthenticationGrantAuthenticationToken idTokenGrant =
                new CibaAuthenticationGrantAuthenticationToken(
                        request.getAuthReqId(),
                        clientPrincipal,
                        Map.of(
                                CibaAuthenticationGrantAuthenticationToken.ACR_VALUES_ATTRIBUTE,
                                request.getAcrValues() == null ? "" : request.getAcrValues(),
                                CibaAuthenticationGrantAuthenticationToken.ACCESS_TOKEN_VALUE,
                                accessToken.getTokenValue(),
                                CibaAuthenticationGrantAuthenticationToken.REFRESH_TOKEN_VALUE,
                                refreshToken == null ? "" : refreshToken.getTokenValue()));
        OidcIdToken idToken = idToken(client, userPrincipal, scopes, idTokenGrant, context);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("access_token", accessToken.getTokenValue());
        response.put("token_type", accessToken.getTokenType().getValue());
        response.put(
                "expires_in",
                Duration.between(accessToken.getIssuedAt(), accessToken.getExpiresAt())
                        .toSeconds());
        response.put("scope", String.join(" ", scopes));
        response.put("id_token", idToken.getTokenValue());
        if (refreshToken != null) {
            response.put("refresh_token", refreshToken.getTokenValue());
        }
        if (!notificationService.deliverPush(request, response)) {
            throw protocol("temporarily_unavailable", "The CIBA push notification failed");
        }

        OAuth2Authorization.Builder authorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .principalName(user.getUsername())
                        .authorizationGrantType(CIBA_GRANT_TYPE)
                        .authorizedScopes(scopes)
                        .attribute(
                                CibaAuthenticationGrantAuthenticationToken.AUTH_REQ_ID_ATTRIBUTE,
                                request.getAuthReqId())
                        .token(
                                accessToken,
                                metadata -> addClaimsIfAvailable(metadata, accessToken));
        authorization.token(
                idToken,
                metadata ->
                        metadata.put(
                                OAuth2Authorization.Token.CLAIMS_METADATA_NAME,
                                idToken.getClaims()));
        if (refreshToken != null) {
            authorization.refreshToken(refreshToken);
        }
        authorizationService.save(authorization.build());
        request.setStatus(CibaAuthenticationRequestStatus.CONSUMED);
        request.setConsumedAt(java.time.Instant.now());
        requestRepository.save(request);
    }

    private OAuth2AccessToken accessToken(
            RegisteredClient client,
            Authentication principal,
            Set<String> scopes,
            CibaAuthenticationGrantAuthenticationToken grant,
            AuthorizationServerContext context) {
        OAuth2Token generated =
                tokenGenerator.generate(
                        tokenContext(
                                client,
                                principal,
                                scopes,
                                grant,
                                context,
                                OAuth2TokenType.ACCESS_TOKEN));
        if (generated == null) {
            throw protocol(SERVER_ERROR, "The token generator failed to generate the access token");
        }
        return generated instanceof OAuth2AccessToken accessToken
                ? accessToken
                : new OAuth2AccessToken(
                        OAuth2AccessToken.TokenType.BEARER,
                        generated.getTokenValue(),
                        generated.getIssuedAt(),
                        generated.getExpiresAt(),
                        scopes);
    }

    private OidcIdToken idToken(
            RegisteredClient client,
            Authentication principal,
            Set<String> scopes,
            CibaAuthenticationGrantAuthenticationToken grant,
            AuthorizationServerContext context) {
        OAuth2Token generated =
                tokenGenerator.generate(
                        tokenContext(
                                client,
                                principal,
                                scopes,
                                grant,
                                context,
                                new OAuth2TokenType(OidcParameterNames.ID_TOKEN)));
        if (!(generated instanceof org.springframework.security.oauth2.jwt.Jwt jwt)) {
            throw protocol(SERVER_ERROR, "The token generator failed to generate the ID token");
        }
        return new OidcIdToken(
                jwt.getTokenValue(), jwt.getIssuedAt(), jwt.getExpiresAt(), jwt.getClaims());
    }

    private OAuth2RefreshToken refreshToken(
            RegisteredClient client,
            Authentication principal,
            Set<String> scopes,
            CibaAuthenticationGrantAuthenticationToken grant,
            AuthorizationServerContext context) {
        OAuth2Token generated =
                tokenGenerator.generate(
                        tokenContext(
                                client,
                                principal,
                                scopes,
                                grant,
                                context,
                                OAuth2TokenType.REFRESH_TOKEN));
        if (!(generated instanceof OAuth2RefreshToken refreshToken)) {
            throw protocol(
                    SERVER_ERROR, "The token generator failed to generate the refresh token");
        }
        return refreshToken;
    }

    private static OAuth2TokenContext tokenContext(
            RegisteredClient client,
            Authentication principal,
            Set<String> scopes,
            CibaAuthenticationGrantAuthenticationToken grant,
            AuthorizationServerContext context,
            OAuth2TokenType tokenType) {
        return DefaultOAuth2TokenContext.builder()
                .registeredClient(client)
                .principal(principal)
                .authorizationServerContext(context)
                .authorizedScopes(scopes)
                .tokenType(tokenType)
                .authorizationGrantType(CIBA_GRANT_TYPE)
                .authorizationGrant(grant)
                .build();
    }

    private static Set<String> authorizedScopes(CibaAuthenticationRequestEntity request) {
        return Arrays.stream(request.getAuthorizedScopes().split(" "))
                .filter(scope -> !scope.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private AuthorizationServerContext currentContext() {
        return Objects.requireNonNullElseGet(
                AuthorizationServerContextHolder.getContext(),
                () ->
                        new AuthorizationServerContext() {
                            @Override
                            public String getIssuer() {
                                return authorizationServerSettings.getIssuer();
                            }

                            @Override
                            public AuthorizationServerSettings getAuthorizationServerSettings() {
                                return authorizationServerSettings;
                            }
                        });
    }

    private static void addClaimsIfAvailable(Map<String, Object> metadata, OAuth2Token token) {
        if (token instanceof ClaimAccessor claimAccessor) {
            metadata.put(OAuth2Authorization.Token.CLAIMS_METADATA_NAME, claimAccessor.getClaims());
        }
    }

    private static CibaProtocolException protocol(String error, String message) {
        return new CibaProtocolException(error, message, HttpStatus.BAD_REQUEST);
    }
}
