package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.domain.OrganizationClaimEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.OrganizationClaimRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthorizationEndpointErrorResponseHandler;
import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import io.github.susimsek.kitezh.security.LocalizedOAuth2ErrorResponseHandler;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2TokenExchangeAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;

class AuthorizationServerConfigAdvancedClaimsTest {

    private final AuthorizationServerConfig config =
            new AuthorizationServerConfig(
                    new ApplicationProperties(),
                    mock(AuthorizationEndpointErrorResponseHandler.class),
                    mock(LocalizedOAuth2ErrorResponseHandler.class));

    @Test
    void emitsEnabledOrganizationClaimsForAccessTokensAndFiltersDisabledClaims() {
        UserRepository userRepository = mock(UserRepository.class);
        OrganizationClaimRepository organizationClaimRepository =
                mock(OrganizationClaimRepository.class);
        UserEntity user = new UserEntity();
        user.setId(42L);
        user.setUsername("sample-client");
        when(userRepository.findByUsername("sample-client")).thenReturn(Optional.of(user));
        when(organizationClaimRepository.findEnabledClaimsForUser(42L))
                .thenReturn(
                        List.of(
                                claim("department", "engineering", true, false, false),
                                claim("department", "security", true, false, false),
                                claim("excluded", "value", false, false, false)));

        JwtEncodingContext context =
                context(
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.AUTHORIZATION_CODE,
                        Set.of("openid"),
                        null);
        config.jwtTokenCustomizer(dependencies(userRepository, organizationClaimRepository))
                .customize(context);

        assertThat(context.getClaims().build().getClaims())
                .containsEntry("department", List.of("engineering", "security"))
                .doesNotContainKey("excluded");
    }

    @Test
    void emitsSingleOrganizationClaimAsScalar() {
        UserRepository userRepository = mock(UserRepository.class);
        OrganizationClaimRepository claimRepository = mock(OrganizationClaimRepository.class);
        UserEntity user = new UserEntity();
        user.setId(42L);
        user.setUsername("sample-client");
        when(userRepository.findByUsername("sample-client")).thenReturn(Optional.of(user));
        when(claimRepository.findEnabledClaimsForUser(42L))
                .thenReturn(List.of(claim("department", "engineering", true, false, false)));

        JwtEncodingContext context =
                context(
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.AUTHORIZATION_CODE,
                        Set.of("openid"),
                        null);
        config.jwtTokenCustomizer(dependencies(userRepository, claimRepository)).customize(context);

        assertThat(context.getClaims().build().getClaims())
                .containsEntry("department", "engineering");
    }

    @Test
    void resolvesOrganizationClaimUsersOnlyForAccessAndIdTokenKinds() {
        UserRepository userRepository = mock(UserRepository.class);
        OrganizationClaimRepository claimRepository = mock(OrganizationClaimRepository.class);
        UserEntity user = new UserEntity();
        user.setId(42L);
        user.setUsername("sample-client");
        when(userRepository.findByUsername("sample-client")).thenReturn(Optional.of(user));
        when(claimRepository.findEnabledClaimsForUser(42L)).thenReturn(List.of());
        var customGrant = new AuthorizationGrantType("urn:custom");

        config.jwtTokenCustomizer(dependencies(userRepository, claimRepository))
                .customize(context(OAuth2TokenType.ACCESS_TOKEN, customGrant, Set.of(), null));
        config.jwtTokenCustomizer(dependencies(userRepository, claimRepository))
                .customize(
                        context(
                                new OAuth2TokenType(OidcParameterNames.ID_TOKEN),
                                customGrant,
                                Set.of(),
                                null));
        config.jwtTokenCustomizer(dependencies(userRepository, claimRepository))
                .customize(context(new OAuth2TokenType("custom"), customGrant, Set.of(), null));

        verify(claimRepository, times(2)).findEnabledClaimsForUser(42L);
    }

    @Test
    void emitsUmaPermissionsAndResourceServerAudienceOnlyForUmaAccessTokens() {
        List<Map<String, Object>> permissions =
                List.of(Map.of("resource_id", "invoice-1", "scopes", List.of("read")));
        UmaTicketAuthenticationToken grant =
                new UmaTicketAuthenticationToken(
                        clientPrincipal(),
                        Map.of(
                                UmaTicketAuthenticationToken.AUTHORIZATION_PERMISSIONS,
                                permissions,
                                "resource_server_client_id",
                                "billing-api"));
        JwtEncodingContext context =
                context(
                        OAuth2TokenType.ACCESS_TOKEN,
                        new org.springframework.security.oauth2.core.AuthorizationGrantType(
                                AuthorizationGrantTypes.UMA_TICKET),
                        Set.of(),
                        grant);

        config.jwtTokenCustomizer(dependencies(null, null)).customize(context);

        assertThat(context.getClaims().build().getClaims())
                .containsEntry("authorization", Map.of("permissions", permissions))
                .containsEntry("aud", List.of("billing-api"));
    }

    @Test
    void omitsEmptyUmaPermissionsAndIgnoresNonStringResourceServerAudience() {
        List<Map<String, Object>> permissions =
                List.of(Map.of("resource_id", "invoice-1", "scopes", List.of("read")));
        UmaTicketAuthenticationToken noPermissionsGrant =
                new UmaTicketAuthenticationToken(
                        clientPrincipal(),
                        Map.of(
                                UmaTicketAuthenticationToken.AUTHORIZATION_PERMISSIONS,
                                List.of(),
                                "resource_server_client_id",
                                "billing-api"));
        JwtEncodingContext emptyPermissionsContext =
                context(
                        OAuth2TokenType.ACCESS_TOKEN,
                        new org.springframework.security.oauth2.core.AuthorizationGrantType(
                                AuthorizationGrantTypes.UMA_TICKET),
                        Set.of(),
                        noPermissionsGrant);
        config.jwtTokenCustomizer(dependencies(null, null)).customize(emptyPermissionsContext);
        assertThat(emptyPermissionsContext.getClaims().build().getClaims())
                .doesNotContainKey("authorization");

        UmaTicketAuthenticationToken invalidAudienceGrant =
                new UmaTicketAuthenticationToken(
                        clientPrincipal(),
                        Map.of(
                                UmaTicketAuthenticationToken.AUTHORIZATION_PERMISSIONS,
                                permissions,
                                "resource_server_client_id",
                                42));
        JwtEncodingContext invalidAudienceContext =
                context(
                        OAuth2TokenType.ACCESS_TOKEN,
                        new org.springframework.security.oauth2.core.AuthorizationGrantType(
                                AuthorizationGrantTypes.UMA_TICKET),
                        Set.of(),
                        invalidAudienceGrant);

        config.jwtTokenCustomizer(dependencies(null, null)).customize(invalidAudienceContext);

        assertThat(invalidAudienceContext.getClaims().build().getClaims())
                .containsEntry("authorization", Map.of("permissions", permissions))
                .doesNotContainKey("aud");
    }

    @Test
    void addsRequestedTokenExchangeAudiencesToAccessTokenClaims() {
        OAuth2TokenExchangeAuthenticationToken grant =
                new OAuth2TokenExchangeAuthenticationToken(
                        "urn:ietf:params:oauth:token-type:access_token",
                        "subject-token",
                        "urn:ietf:params:oauth:token-type:access_token",
                        clientPrincipal(),
                        null,
                        null,
                        null,
                        Set.of("z-api", "a-api"),
                        Set.of(),
                        Map.of());
        JwtEncodingContext context =
                context(
                        OAuth2TokenType.ACCESS_TOKEN,
                        new AuthorizationGrantType(AuthorizationGrantTypes.TOKEN_EXCHANGE),
                        Set.of(),
                        grant);

        config.jwtTokenCustomizer(dependencies(null, null)).customize(context);

        assertThat(context.getClaims().build().getClaims())
                .containsEntry("aud", List.of("a-api", "z-api"));
    }

    @Test
    void defaultsTokenExchangeAudienceToTheRegisteredClient() {
        OAuth2TokenExchangeAuthenticationToken grant =
                new OAuth2TokenExchangeAuthenticationToken(
                        "urn:ietf:params:oauth:token-type:access_token",
                        "subject-token",
                        "urn:ietf:params:oauth:token-type:access_token",
                        clientPrincipal(),
                        null,
                        null,
                        null,
                        Set.of(),
                        Set.of(),
                        Map.of());
        JwtEncodingContext context =
                context(
                        OAuth2TokenType.ACCESS_TOKEN,
                        new AuthorizationGrantType(AuthorizationGrantTypes.TOKEN_EXCHANGE),
                        Set.of(),
                        grant);

        config.jwtTokenCustomizer(dependencies(null, null)).customize(context);

        assertThat(context.getClaims().build().getClaims())
                .containsEntry("aud", List.of("sample-client"));
    }

    @Test
    void addsCibaAuthenticationAndTokenHashClaimsToIdTokens() {
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("sample-client")).thenReturn(Optional.empty());
        CibaAuthenticationGrantAuthenticationToken grant =
                new CibaAuthenticationGrantAuthenticationToken(
                        "auth-request-1",
                        clientPrincipal(),
                        Map.of(
                                CibaAuthenticationGrantAuthenticationToken.ACR_VALUES_ATTRIBUTE,
                                "urn:acr:high urn:acr:low",
                                CibaAuthenticationGrantAuthenticationToken.ACCESS_TOKEN_VALUE,
                                "access-value",
                                CibaAuthenticationGrantAuthenticationToken.REFRESH_TOKEN_VALUE,
                                "refresh-value"));
        JwtEncodingContext context =
                context(
                        new OAuth2TokenType(OidcParameterNames.ID_TOKEN),
                        new AuthorizationGrantType(AuthorizationGrantTypes.CIBA),
                        Set.of("openid"),
                        grant);

        config.jwtTokenCustomizer(dependencies(userRepository, null)).customize(context);

        assertThat(context.getClaims().build().getClaims())
                .containsEntry(
                        CibaAuthenticationGrantAuthenticationToken.AUTH_REQ_ID_CLAIM,
                        "auth-request-1")
                .containsEntry("acr", "urn:acr:high")
                .containsKey("at_hash")
                .containsKey("urn:openid:params:jwt:claim:rt_hash");
    }

    @Test
    void selectsCibaTokenHashDigestFromTheSigningAlgorithm() {
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("sample-client")).thenReturn(Optional.empty());
        for (SignatureAlgorithm algorithm :
                List.of(SignatureAlgorithm.RS512, SignatureAlgorithm.ES384)) {
            CibaAuthenticationGrantAuthenticationToken grant =
                    new CibaAuthenticationGrantAuthenticationToken(
                            "auth-request-1",
                            clientPrincipal(),
                            Map.of(
                                    CibaAuthenticationGrantAuthenticationToken.ACCESS_TOKEN_VALUE,
                                    "access-value"));
            JwtEncodingContext context =
                    context(
                            new OAuth2TokenType(OidcParameterNames.ID_TOKEN),
                            new AuthorizationGrantType(AuthorizationGrantTypes.CIBA),
                            Set.of("openid"),
                            grant,
                            algorithm);

            config.jwtTokenCustomizer(dependencies(userRepository, null)).customize(context);

            assertThat(context.getClaims().build().getClaims()).containsKey("at_hash");
        }
    }

    private static AuthorizationServerConfig.JwtTokenCustomizerDependencies dependencies(
            UserRepository userRepository, OrganizationClaimRepository claimRepository) {
        return new AuthorizationServerConfig.JwtTokenCustomizerDependencies(
                userRepository,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                false,
                null,
                null,
                claimRepository);
    }

    private static JwtEncodingContext context(
            OAuth2TokenType tokenType,
            AuthorizationGrantType grantType,
            Set<String> scopes,
            Authentication authorizationGrant) {
        return context(tokenType, grantType, scopes, authorizationGrant, SignatureAlgorithm.RS256);
    }

    private static JwtEncodingContext context(
            OAuth2TokenType tokenType,
            AuthorizationGrantType grantType,
            Set<String> scopes,
            Authentication authorizationGrant,
            SignatureAlgorithm algorithm) {
        RegisteredClient registeredClient =
                RegisteredClient.withId("client-id")
                        .clientId("sample-client")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .authorizationGrantType(
                                new org.springframework.security.oauth2.core.AuthorizationGrantType(
                                        AuthorizationGrantTypes.UMA_TICKET))
                        .redirectUri("https://client.example/callback")
                        .clientSettings(ClientSettings.builder().build())
                        .scope("openid")
                        .build();
        Authentication principal = clientPrincipal();
        JwtEncodingContext.Builder builder =
                JwtEncodingContext.with(JwsHeader.with(algorithm), JwtClaimsSet.builder())
                        .registeredClient(registeredClient)
                        .principal(principal)
                        .authorizedScopes(scopes)
                        .tokenType(tokenType)
                        .authorizationGrantType(grantType);
        if (authorizationGrant != null) {
            builder.authorizationGrant(authorizationGrant);
        }
        return builder.build();
    }

    private static Authentication clientPrincipal() {
        return new UsernamePasswordAuthenticationToken("sample-client", "secret");
    }

    private static OrganizationClaimEntity claim(
            String name, String value, boolean accessToken, boolean idToken, boolean userInfo) {
        OrganizationClaimEntity claim = new OrganizationClaimEntity();
        claim.setClaimName(name);
        claim.setClaimValue(value);
        claim.setAddToAccessToken(accessToken);
        claim.setAddToIdToken(idToken);
        claim.setAddToUserInfo(userInfo);
        return claim;
    }
}
