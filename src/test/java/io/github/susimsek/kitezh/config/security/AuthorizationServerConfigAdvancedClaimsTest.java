package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
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
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
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
                JwtEncodingContext.with(
                                JwsHeader.with(SignatureAlgorithm.RS256), JwtClaimsSet.builder())
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
