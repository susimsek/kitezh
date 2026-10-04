package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nimbusds.jose.jwk.JWK;
import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.config.observability.LoggingProperties;
import io.github.susimsek.kitezh.config.observability.ObservabilityMdcFilter;
import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.ClientMapperEntity;
import io.github.susimsek.kitezh.domain.ClientRoleEntity;
import io.github.susimsek.kitezh.domain.ClientScopeEntity;
import io.github.susimsek.kitezh.domain.ClientScopeMapperEntity;
import io.github.susimsek.kitezh.domain.GroupAttribute;
import io.github.susimsek.kitezh.domain.GroupEntity;
import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import io.github.susimsek.kitezh.domain.ServiceAccountEntity;
import io.github.susimsek.kitezh.domain.SocialIdentityEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.domain.UserProfileAttributeDefinitionEntity;
import io.github.susimsek.kitezh.domain.UserProfileAttributeEntity;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.ClientMapperRepository;
import io.github.susimsek.kitezh.repository.ClientScopeMapperRepository;
import io.github.susimsek.kitezh.repository.ClientScopeRepository;
import io.github.susimsek.kitezh.repository.ServiceAccountRepository;
import io.github.susimsek.kitezh.repository.SocialIdentityRepository;
import io.github.susimsek.kitezh.repository.UserAvatarRepository;
import io.github.susimsek.kitezh.repository.UserProfileAttributeRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthorizationEndpointErrorResponseHandler;
import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import io.github.susimsek.kitezh.security.ClientSecuritySettings;
import io.github.susimsek.kitezh.security.LocalizedOAuth2ErrorResponseHandler;
import io.github.susimsek.kitezh.security.OAuth2KeyJwkSource;
import io.github.susimsek.kitezh.security.OidcSessionIdentifier;
import io.github.susimsek.kitezh.security.ProtocolMapperTypes;
import io.github.susimsek.kitezh.service.OAuth2KeyService;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.context.ApplicationContext;
import org.springframework.context.support.StaticApplicationContext;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.ObjectPostProcessor;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtEncodingException;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationServerMetadata;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.oidc.OidcProviderConfiguration;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import tools.jackson.databind.ObjectMapper;

class AuthorizationServerConfigTest {

    private final ApplicationProperties applicationProperties = applicationProperties();

    private final AuthorizationServerConfig config =
            new AuthorizationServerConfig(
                    applicationProperties,
                    mock(AuthorizationEndpointErrorResponseHandler.class),
                    mock(LocalizedOAuth2ErrorResponseHandler.class));

    @Test
    void createsAuthorizationServerSettingsFromProperties() {
        AuthorizationServerSettings settings = config.authorizationServerSettings();

        assertThat(settings.getIssuer()).isEqualTo("https://issuer.example");
    }

    @Test
    void addsCibaMetadataToAuthorizationServerDescriptors() {
        OAuth2AuthorizationServerMetadata.Builder builder =
                OAuth2AuthorizationServerMetadata.builder()
                        .issuer("https://issuer.example")
                        .authorizationEndpoint("https://issuer.example/oauth2/authorize")
                        .tokenEndpoint("https://issuer.example/oauth2/token")
                        .jwkSetUrl("https://issuer.example/oauth2/jwks")
                        .responseType("code");

        AuthorizationServerConfig.addCibaMetadata(builder, "https://issuer.example");

        assertThat(builder.build().getClaims())
                .containsEntry(
                        "backchannel_authentication_endpoint",
                        "https://issuer.example/oauth2/bc-authorize")
                .containsEntry(
                        "backchannel_token_delivery_modes_supported",
                        List.of("poll", "ping", "push"))
                .containsEntry(
                        "backchannel_authentication_request_signing_alg_values_supported",
                        List.of("RS256", "ES256"))
                .containsEntry("backchannel_user_code_parameter", true)
                .containsEntry("grant_types_supported", List.of(AuthorizationGrantTypes.CIBA));

        OidcProviderConfiguration.Builder oidcBuilder =
                OidcProviderConfiguration.builder()
                        .issuer("https://issuer.example")
                        .authorizationEndpoint("https://issuer.example/oauth2/authorize")
                        .tokenEndpoint("https://issuer.example/oauth2/token")
                        .jwkSetUrl("https://issuer.example/oauth2/jwks")
                        .responseType("code")
                        .subjectType("public")
                        .idTokenSigningAlgorithm("RS256");
        AuthorizationServerConfig.addCibaMetadata(oidcBuilder, "https://issuer.example");
        assertThat(oidcBuilder.build().getClaims())
                .containsEntry("backchannel_user_code_parameter", true);
    }

    @Test
    void createsDatabaseBackedJwkSource() {
        OAuth2KeyService oauth2KeyService = mock(OAuth2KeyService.class);

        var jwkSource = config.jwkSource(oauth2KeyService);

        assertThat(jwkSource).isInstanceOf(OAuth2KeyJwkSource.class);
    }

    @Test
    void createsJwtDecoder() {
        OAuth2KeyService oauth2KeyService = mock(OAuth2KeyService.class);
        var jwkSource = config.jwkSource(oauth2KeyService);

        JwtDecoder jwtDecoder = config.jwtDecoder(jwkSource);

        assertThat(jwtDecoder).isNotNull();
    }

    @Test
    void createsJwtEncoderAndTokenGenerator() {
        var jwkSource = config.jwkSource(mock(OAuth2KeyService.class));
        var jwtEncoder = config.jwtEncoder(jwkSource);
        var tokenGenerator =
                config.tokenGenerator(
                        jwtEncoder, context -> context.getClaims().claim("test", true));

        assertThat(jwtEncoder).isNotNull();
        assertThat(tokenGenerator).isNotNull();
    }

    @Test
    void buildsAuthorizationServerSecurityFilterChain() {
        SecurityFilterChain chain =
                config.authorizationServerSecurityFilterChain(
                        httpSecurity(),
                        mock(OAuth2TokenGenerator.class),
                        mock(RegisteredClientRepository.class),
                        new AuthorizationServerConfig.AuthorizationServerFilterDependencies(
                                mock(RequiredActionAuthorizationFilter.class),
                                mock(MfaAuthorizationFilter.class),
                                mock(
                                        org.springframework.security.crypto.password.PasswordEncoder
                                                .class),
                                mock(CibaAuthenticationGrantAuthenticationProvider.class),
                                mock(SocialProviderLogoutSuccessHandler.class),
                                mock(SecurityContextRepository.class),
                                new ObservabilityMdcFilter()));

        assertThat(chain).isNotNull();
        assertThat(chain.getFilters()).isNotEmpty();
    }

    @Test
    void buildsAuthorizationServerSecurityFilterChainFromBeanDependencies() {
        SecurityFilterChain chain =
                config.authorizationServerSecurityFilterChain(
                        httpSecurity(),
                        mock(OAuth2TokenGenerator.class),
                        mock(RegisteredClientRepository.class),
                        mock(org.springframework.security.crypto.password.PasswordEncoder.class),
                        mock(RequiredActionAuthorizationFilter.class),
                        mock(MfaAuthorizationFilter.class),
                        mock(CibaAuthenticationGrantAuthenticationProvider.class),
                        mock(SocialProviderLogoutSuccessHandler.class),
                        mock(SecurityContextRepository.class),
                        new LoggingProperties());

        assertThat(chain).isNotNull();
    }

    @Test
    void bindsDpopProofThumbprintToAccessToken() throws Exception {
        Map<String, Object> jwk = Map.of("kty", "oct", "k", "c2VjcmV0");
        Jwt proof =
                new Jwt(
                        "proof",
                        Instant.now().minusSeconds(1),
                        Instant.now().plusSeconds(60),
                        Map.of("jwk", jwk),
                        Map.of("htm", "GET"));
        JwtEncodingContext context =
                dpopContext(
                        RegisteredClient.withId("dpop-id")
                                .clientId("dpop-client")
                                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                                .redirectUri("https://client.example/callback")
                                .build(),
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.AUTHORIZATION_CODE,
                        proof);

        config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class))
                .customize(context);

        assertThat((Map<String, Object>) context.getClaims().build().getClaim("cnf"))
                .containsEntry("jkt", JWK.parse(jwk).computeThumbprint().toString());
    }

    @Test
    void rejectsDpopProofWhenClientJktDoesNotMatch() {
        Map<String, Object> jwk = Map.of("kty", "oct", "k", "c2VjcmV0");
        Jwt proof =
                new Jwt(
                        "proof",
                        Instant.now().minusSeconds(1),
                        Instant.now().plusSeconds(60),
                        Map.of("jwk", jwk),
                        Map.of("htm", "GET"));
        RegisteredClient client =
                RegisteredClient.withId("dpop-jkt-id")
                        .clientId("dpop-jkt-client")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("https://client.example/callback")
                        .clientSettings(
                                ClientSettings.builder()
                                        .setting(ClientSecuritySettings.REQUIRE_DPOP_JKT, true)
                                        .build())
                        .build();

        var customizer =
                config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class));
        JwtEncodingContext context =
                dpopContext(
                        client,
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.AUTHORIZATION_CODE,
                        proof,
                        OAuth2Authorization.withRegisteredClient(client)
                                .id("authorization-id")
                                .principalName("admin")
                                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                                .attribute(
                                        OAuth2AuthorizationRequest.class.getName(),
                                        OAuth2AuthorizationRequest.authorizationCode()
                                                .authorizationUri(
                                                        "https://issuer.example/oauth2/authorize")
                                                .clientId(client.getClientId())
                                                .redirectUri("https://client.example/callback")
                                                .additionalParameters(Map.of("dpop_jkt", "wrong"))
                                                .build())
                                .build());

        assertThatThrownBy(() -> customizer.customize(context))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    @Test
    void skipsDpopConfirmationForRefreshOnlyClientCredentials() {
        Map<String, Object> jwk = Map.of("kty", "oct", "k", "c2VjcmV0");
        Jwt proof =
                new Jwt(
                        "proof",
                        Instant.now().minusSeconds(1),
                        Instant.now().plusSeconds(60),
                        Map.of("jwk", jwk),
                        Map.of("htm", "GET"));
        RegisteredClient client =
                RegisteredClient.withId("refresh-dpop-id")
                        .clientId("refresh-dpop-client")
                        .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                        .clientSettings(
                                ClientSettings.builder()
                                        .setting(
                                                ClientSecuritySettings.DPOP_REFRESH_TOKEN_ONLY,
                                                true)
                                        .build())
                        .build();
        JwtEncodingContext context =
                dpopContext(
                        client,
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.REFRESH_TOKEN,
                        proof);
        config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class))
                .customize(context);

        context.getClaims().claim("sub", "admin");
        assertThat(context.getClaims().build().getClaims()).doesNotContainKey("cnf");
    }

    @Test
    void ignoresDpopProofWithoutJwkHeader() {
        Jwt proof =
                new Jwt(
                        "proof",
                        Instant.now().minusSeconds(1),
                        Instant.now().plusSeconds(60),
                        Map.of("alg", "RS256"),
                        Map.of("htm", "GET"));
        RegisteredClient client =
                RegisteredClient.withId("dpop-no-jwk-id")
                        .clientId("dpop-no-jwk-client")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("https://client.example/callback")
                        .build();
        JwtEncodingContext context =
                dpopContext(
                        client,
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.AUTHORIZATION_CODE,
                        proof);

        config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class))
                .customize(context);

        context.getClaims().claim("sub", "admin");
        assertThat(context.getClaims().build().getClaims()).doesNotContainKey("cnf");
    }

    @Test
    void rejectsMalformedDpopJwk() {
        Jwt proof =
                new Jwt(
                        "proof",
                        Instant.now().minusSeconds(1),
                        Instant.now().plusSeconds(60),
                        Map.of("jwk", Map.of("kty", "oct")),
                        Map.of("htm", "GET"));
        RegisteredClient client =
                RegisteredClient.withId("dpop-malformed-id")
                        .clientId("dpop-malformed-client")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("https://client.example/callback")
                        .build();
        JwtEncodingContext context =
                dpopContext(
                        client,
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.AUTHORIZATION_CODE,
                        proof);
        var customizer =
                config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class));

        assertThatThrownBy(() -> customizer.customize(context))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("thumbprint");
    }

    @Test
    void rejectsJwtEncodingWhenNoPrivateSigningKeyExists() {
        JWK publicKey = mock(JWK.class);
        JwtEncoder encoder = config.jwtEncoder((selector, securityContext) -> List.of(publicKey));
        JwtClaimsSet claims = JwtClaimsSet.builder().claim("sub", "admin").build();
        JwtEncoderParameters parameters = JwtEncoderParameters.from(claims);

        assertThatThrownBy(() -> encoder.encode(parameters))
                .isInstanceOf(JwtEncodingException.class)
                .hasRootCauseMessage("Expected private JWK but none available");
    }

    @Test
    void acceptsPrivateSigningKeyFromJwkSource() {
        JWK privateKey = mock(JWK.class);
        when(privateKey.isPrivate()).thenReturn(true);
        JwtEncoder encoder = config.jwtEncoder((selector, securityContext) -> List.of(privateKey));

        assertThat(encoder).isNotNull();
    }

    @Test
    void addsProfilePictureAndAdminRolesToAccessToken() {
        UserEntity user = new UserEntity();
        user.setId(42L);
        GroupEntity group = new GroupEntity();
        group.setName("platform-administrators");
        user.setGroups(Set.of(group));
        user.setPreferredLocale("tr");
        final UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        UserAvatarRepository.AvatarVersion avatar = mock(UserAvatarRepository.AvatarVersion.class);
        when(avatar.getPublicId()).thenReturn("avatar-id");
        when(avatar.getUpdatedAt()).thenReturn(Instant.parse("2026-01-01T00:00:00Z"));
        final UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        final AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        when(authorizationRepository.findSessionIdById("authorization-id"))
                .thenReturn(Optional.of("browser-session"));
        when(avatarRepository.findVersionByUserId(42L)).thenReturn(Optional.of(avatar));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "admin-console",
                                Set.of("profile")));

        assertThat(claims.build().getClaims())
                .containsEntry(
                        "picture", "https://issuer.example/avatars/avatar-id?v=1767225600000")
                .containsEntry("roles", List.of("ROLE_ADMIN", "ROLE_USER"))
                .containsEntry("locale", "tr")
                .containsEntry("groups", List.of("/platform-administrators"))
                .containsEntry("sid", OidcSessionIdentifier.fromSessionId("browser-session"));
        verify(userRepository).findByUsername("admin");
        verify(avatarRepository).findVersionByUserId(42L);
    }

    @Test
    void addsAdminRolesToDesktopAdminAccessToken() {
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(new UserEntity()));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class))
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "desktop-admin-console",
                                Set.of("admin-api")));

        assertThat(claims.build().getClaims())
                .containsEntry("roles", List.of("ROLE_ADMIN", "ROLE_USER"));
    }

    @Test
    void addsClientRolesOnlyWhenRolesScopeIsAuthorized() {
        UserEntity user = new UserEntity();
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setClientId("orders-api");
        user.setClientRoles(Set.of(new ClientRoleEntity(client, "orders.read", null)));
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);

        JwtClaimsSet.Builder rolesClaims = JwtClaimsSet.builder().claim("sub", "admin");
        config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                .customize(
                        jwtContext(
                                rolesClaims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "orders-api",
                                Set.of("roles")));

        assertThat(rolesClaims.build().getClaims())
                .containsEntry(
                        "resource_access",
                        Map.of("orders-api", Map.of("roles", List.of("orders.read"))));

        JwtClaimsSet.Builder noRolesClaims = JwtClaimsSet.builder().claim("sub", "admin");
        config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                .customize(
                        jwtContext(
                                noRolesClaims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "orders-api",
                                Set.of("openid")));

        assertThat(noRolesClaims.build().getClaims()).doesNotContainKey("resource_access");
    }

    @Test
    void omitsClientRolesWhenTheUserHasNoEffectiveClientRoles() {
        UserEntity user = new UserEntity();
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class))
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "orders-api",
                                Set.of("roles")));

        assertThat(claims.build().getClaims()).doesNotContainKey("resource_access");
    }

    @Test
    void usesTheDatabaseServiceAccountForClientCredentialsTokens() {
        UserEntity serviceUser = new UserEntity();
        serviceUser.setUsername("service-account-api");
        serviceUser.setServiceAccount(true);
        ServiceAccountEntity account = new ServiceAccountEntity("client-id", serviceUser);
        ServiceAccountRepository serviceAccountRepository = mock(ServiceAccountRepository.class);
        when(serviceAccountRepository.findByClientId("client-id")).thenReturn(Optional.of(account));
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("service-account-api"))
                .thenReturn(Optional.of(serviceUser));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "client-id");

        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        null,
                        null,
                        null,
                        serviceAccountRepository,
                        null,
                        null,
                        null)
                .customize(
                        jwtContextWithoutAuthorization(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.CLIENT_CREDENTIALS,
                                "api",
                                Set.of()));

        assertThat(claims.build().getSubject()).isEqualTo("service-account-api");
    }

    @Test
    void fallsBackToTheAuthenticatedUserWhenClientCredentialsHasNoServiceAccount() {
        ServiceAccountRepository serviceAccountRepository = mock(ServiceAccountRepository.class);
        when(serviceAccountRepository.findByClientId("client-id")).thenReturn(Optional.empty());
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        null,
                        null,
                        null,
                        serviceAccountRepository,
                        null,
                        null,
                        null)
                .customize(
                        jwtContextWithoutAuthorization(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.CLIENT_CREDENTIALS,
                                "api",
                                Set.of("roles")));

        assertThat(claims.build().getClaims()).doesNotContainKey("resource_access");
    }

    @Test
    @SuppressWarnings("unchecked")
    void addsRealmAndCrossClientCompositeRolesToRoleToken() {
        AuthorityEntity administrator = new AuthorityEntity(1L, "ROLE_ADMINISTRATOR");
        RegisteredClientEntity ordersClient = new RegisteredClientEntity();
        ordersClient.setClientId("orders-api");
        ClientRoleEntity ordersRead = new ClientRoleEntity(ordersClient, "orders.read", null);
        administrator.setCompositeClientRoles(Set.of(ordersRead));
        AuthorityEntity auditor = new AuthorityEntity(2L, "ROLE_AUDITOR");
        RegisteredClientEntity billingClient = new RegisteredClientEntity();
        billingClient.setClientId("billing-api");
        ClientRoleEntity billingManage =
                new ClientRoleEntity(billingClient, "billing.manage", null);
        billingManage.setCompositeRealmRoles(Set.of(auditor));
        UserEntity user = new UserEntity();
        user.setAuthorities(Set.of(administrator));
        user.setClientRoles(Set.of(billingManage));

        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "orders-api",
                                Set.of("roles")));

        Map<String, Object> tokenClaims = claims.build().getClaims();
        Map<String, Object> realmAccess = (Map<String, Object>) tokenClaims.get("realm_access");
        assertThat((List<String>) realmAccess.get("roles"))
                .containsExactlyInAnyOrder("ROLE_ADMINISTRATOR", "ROLE_AUDITOR");
        assertThat(tokenClaims)
                .containsEntry(
                        "resource_access",
                        Map.of(
                                "billing-api", Map.of("roles", List.of("billing.manage")),
                                "orders-api", Map.of("roles", List.of("orders.read"))));
    }

    @Test
    void doesNotQueryAvatarForTokensOutsideUserProfileFlows() {
        UserRepository userRepository = mock(UserRepository.class);
        final UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        final AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                .customize(
                        jwtContext(
                                claims,
                                new OAuth2TokenType("refresh_token"),
                                AuthorizationGrantType.CLIENT_CREDENTIALS,
                                "other-client",
                                Set.of()));

        claims.claim("sub", "admin");
        assertThat(claims.build().getClaims()).doesNotContainKeys("picture", "roles");
        verify(userRepository, never()).findByUsername(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void preservesNonceInOidcIdToken() {
        UserRepository userRepository = mock(UserRepository.class);
        final UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        final AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder();

        config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                .customize(
                        jwtContext(
                                claims,
                                new OAuth2TokenType(OidcParameterNames.ID_TOKEN),
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "account-console",
                                Set.of("openid"),
                                "nonce-value"));

        assertThat(claims.build().getClaims())
                .containsEntry(OidcParameterNames.NONCE, "nonce-value");
    }

    @Test
    void skipsNonceWhenAuthorizationRequestIsMissingOrBlank() {
        RegisteredClient client =
                RegisteredClient.withId("nonce-client")
                        .clientId("nonce-client")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("https://client.example/callback")
                        .build();
        OAuth2Authorization authorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .id("nonce-authorization")
                        .principalName("admin")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .build();
        JwtClaimsSet.Builder missingRequestClaims = JwtClaimsSet.builder().claim("sub", "admin");
        JwtEncodingContext missingRequest =
                JwtEncodingContext.with(
                                JwsHeader.with(SignatureAlgorithm.RS256), missingRequestClaims)
                        .registeredClient(client)
                        .authorization(authorization)
                        .principal(new UsernamePasswordAuthenticationToken("admin", "n/a"))
                        .authorizedScopes(Set.of("openid"))
                        .tokenType(new OAuth2TokenType(OidcParameterNames.ID_TOKEN))
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .build();

        config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class))
                .customize(missingRequest);

        assertThat(missingRequestClaims.build().getClaims())
                .doesNotContainKey(OidcParameterNames.NONCE);

        JwtClaimsSet.Builder blankNonceClaims = JwtClaimsSet.builder().claim("sub", "admin");
        config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class))
                .customize(
                        jwtContext(
                                blankNonceClaims,
                                new OAuth2TokenType(OidcParameterNames.ID_TOKEN),
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "account-console",
                                Set.of("openid"),
                                " "));

        assertThat(blankNonceClaims.build().getClaims())
                .doesNotContainKey(OidcParameterNames.NONCE);
    }

    @Test
    void addsEmailAndLocaleClaimsAndSkipsMissingAvatar() {
        UserEntity user = new UserEntity();
        user.setId(42L);
        user.setEmail("ada@example.test");
        user.setEmailVerified(true);
        user.setPreferredLocale("tr");
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        when(avatarRepository.findVersionByUserId(42L)).thenReturn(Optional.empty());
        AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder();

        config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "account-console",
                                Set.of("email", "profile")));

        assertThat(claims.build().getClaims())
                .containsEntry("email", "ada@example.test")
                .containsEntry("email_verified", true)
                .containsEntry("locale", "tr")
                .doesNotContainKey("picture");
    }

    @Test
    void appliesClientMappersInPriorityOrderAndMergesAudienceClaims() {
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        AuthorityEntity role = new AuthorityEntity();
        role.setName("ROLE_REPORTS");
        user.setAuthorities(Set.of(role));
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        ClientMapperRepository mapperRepository = mock(ClientMapperRepository.class);
        ClientMapperEntity audience = mapper("audience", "audience", null, "reports-api", 0);
        ClientMapperEntity low = mapper("low", "hardcoded-claim", "same", "low", 10);
        ClientMapperEntity high = mapper("high", "hardcoded-claim", "same", "high", 20);
        ClientMapperEntity roles = mapper("roles", "user-realm-role", "roles", null, 30);
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-id"))
                .thenReturn(List.of(high, roles, low, audience));

        JwtClaimsSet.Builder claims =
                JwtClaimsSet.builder().claim("sub", "admin").claim("aud", "existing");

        config.jwtTokenCustomizer(
                        userRepository,
                        avatarRepository,
                        authorizationRepository,
                        null,
                        mapperRepository,
                        mock(ClientScopeMapperRepository.class),
                        mock(ServiceAccountRepository.class),
                        mock(UserProfileAttributeRepository.class),
                        null,
                        null)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "demo-client",
                                Set.of("openid")));

        assertThat(claims.build().getClaims())
                .containsEntry("same", "high")
                .containsEntry("roles", Set.of("ROLE_REPORTS"))
                .containsEntry("aud", List.of("existing", "reports-api"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void mapsAllConfiguredClientMapperTypes() {
        UserEntity user = new UserEntity();
        user.setId(42L);
        user.setUsername("admin");
        user.setFirstName("Ada");
        user.setLastName("Lovelace");
        user.setEmail("ada@example.test");
        user.setPreferredLocale("tr");
        GroupEntity group = new GroupEntity();
        group.setName("engineering");
        group.setAttributes(Set.of(new GroupAttribute("department", "platform")));
        user.setGroups(Set.of(group));
        AuthorityEntity realmRole = new AuthorityEntity();
        realmRole.setName("ROLE_REPORTS");
        RegisteredClientEntity ordersClient = new RegisteredClientEntity();
        ordersClient.setClientId("orders-api");
        ClientRoleEntity ordersRole = new ClientRoleEntity(ordersClient, "orders.read", null);
        RegisteredClientEntity currentClient = new RegisteredClientEntity();
        currentClient.setClientId("demo-client");
        ClientRoleEntity currentRole = new ClientRoleEntity(currentClient, "demo.read", null);
        user.setAuthorities(Set.of(realmRole));
        user.setClientRoles(Set.of(ordersRole, currentRole));

        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        UserProfileAttributeDefinitionEntity definition =
                new UserProfileAttributeDefinitionEntity();
        definition.setName("departmentCode");
        UserProfileAttributeRepository attributeRepository =
                mock(UserProfileAttributeRepository.class);
        when(attributeRepository
                        .findAllByUserIdOrderByDefinitionDisplayOrderAscDefinitionNameAscPositionAsc(
                                42L))
                .thenReturn(
                        List.of(new UserProfileAttributeEntity(user, definition, 0, "PLATFORM")));

        ClientScopeEntity scope = new ClientScopeEntity();
        scope.setId("mapper-scope-id");
        scope.setName("mapper-scope");
        AuthorityEntity scopedRealmRole = new AuthorityEntity();
        scopedRealmRole.setName("ROLE_REPORTS");
        scope.setApplicationRoles(Set.of(scopedRealmRole));
        ClientRoleEntity scopedOrdersRole = new ClientRoleEntity(ordersClient, "orders.read", null);
        scope.setClientRoles(Set.of(scopedOrdersRole));
        ClientScopeRepository scopeRepository = mock(ClientScopeRepository.class);
        when(scopeRepository.findByNameIn(Set.of("mapper-scope"))).thenReturn(List.of(scope));
        when(scopeRepository.findDetailedByNameIn(Set.of("mapper-scope")))
                .thenReturn(List.of(scope));

        ClientMapperEntity firstName =
                mapper("first-name", ProtocolMapperTypes.USER_PROPERTY, "firstName", null, 1);
        firstName.setSource("firstName");
        ClientMapperEntity customAttribute =
                mapper(
                        "custom-attribute",
                        ProtocolMapperTypes.USER_ATTRIBUTE,
                        "departmentCode",
                        null,
                        2);
        customAttribute.setSource("departmentCode");
        ClientMapperEntity groupAttribute =
                mapper(
                        "group-attribute",
                        ProtocolMapperTypes.GROUP_ATTRIBUTE,
                        "department",
                        null,
                        4);
        groupAttribute.setSource("department");
        ClientMapperRepository mapperRepository = mock(ClientMapperRepository.class);
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-id"))
                .thenReturn(
                        List.of(
                                firstName,
                                customAttribute,
                                mapper(
                                        "groups",
                                        ProtocolMapperTypes.GROUP_MEMBERSHIP,
                                        "groups",
                                        null,
                                        3),
                                groupAttribute,
                                mapper(
                                        "application-role",
                                        ProtocolMapperTypes.APPLICATION_ROLE,
                                        "applicationRole",
                                        null,
                                        5),
                                mapper(
                                        "client-role",
                                        ProtocolMapperTypes.CLIENT_ROLE,
                                        "clientRole",
                                        null,
                                        6),
                                mapper("email", ProtocolMapperTypes.EMAIL, "mappedEmail", null, 7),
                                mapper(
                                        "full-name",
                                        ProtocolMapperTypes.FULL_NAME,
                                        "fullName",
                                        null,
                                        8),
                                mapper(
                                        "locale",
                                        ProtocolMapperTypes.LOCALE,
                                        "mappedLocale",
                                        null,
                                        9),
                                mapper(
                                        "username",
                                        ProtocolMapperTypes.USERNAME,
                                        "mappedUsername",
                                        null,
                                        10),
                                mapper(
                                        "audience-resolve",
                                        ProtocolMapperTypes.AUDIENCE_RESOLVE,
                                        null,
                                        null,
                                        11)));

        ClientScopeMapperEntity scopeMapper = new ClientScopeMapperEntity();
        scopeMapper.setName("scoped-hardcoded");
        scopeMapper.setMapperType(ProtocolMapperTypes.HARDCODED_CLAIM);
        scopeMapper.setClaimName("scopedClaim");
        scopeMapper.setValue("scoped");
        scopeMapper.setPriority(12);
        ClientScopeMapperRepository scopeMapperRepository = mock(ClientScopeMapperRepository.class);
        when(scopeMapperRepository.findAllByClientScopeIdInOrderByPriorityAscNameAsc(
                        List.of("mapper-scope-id")))
                .thenReturn(List.of(scopeMapper));

        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");
        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        scopeRepository,
                        mapperRepository,
                        scopeMapperRepository,
                        mock(ServiceAccountRepository.class),
                        attributeRepository,
                        null,
                        null)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "demo-client",
                                Set.of("mapper-scope")));

        Map<String, Object> mapped = claims.build().getClaims();
        assertThat(mapped)
                .containsEntry("firstName", "Ada")
                .containsEntry("departmentCode", "PLATFORM")
                .containsEntry("groups", List.of("/engineering"))
                .containsEntry("department", "platform")
                .containsEntry("mappedEmail", "ada@example.test")
                .containsEntry("fullName", "Ada Lovelace")
                .containsEntry("mappedLocale", "tr")
                .containsEntry("mappedUsername", "admin")
                .containsEntry("scopedClaim", "scoped")
                .containsEntry("aud", List.of("orders-api"));
        assertThat((Set<String>) mapped.get("applicationRole")).contains("ROLE_REPORTS");
        assertThat((Set<String>) mapped.get("clientRole")).contains("demo.read");
    }

    @Test
    @SuppressWarnings("unchecked")
    void handlesEmptyAndUnsupportedClientMapperValues() {
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        user.setGroups(null);
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        ClientMapperEntity unknownProperty =
                mapper("unknown-property", ProtocolMapperTypes.USER_PROPERTY, "unknown", null, 3);
        unknownProperty.setSource("unknown");
        ClientMapperEntity blankAttribute =
                mapper("blank-attribute", ProtocolMapperTypes.USER_ATTRIBUTE, "attribute", null, 4);
        blankAttribute.setSource(" ");
        ClientMapperEntity groups =
                mapper("groups", ProtocolMapperTypes.GROUP_MEMBERSHIP, "groups", null, 5);
        ClientMapperEntity groupAttribute =
                mapper(
                        "group-attribute",
                        ProtocolMapperTypes.GROUP_ATTRIBUTE,
                        "attribute",
                        null,
                        6);
        groupAttribute.setSource(null);
        ClientMapperEntity applicationRole =
                mapper("application-role", ProtocolMapperTypes.APPLICATION_ROLE, "roles", null, 7);
        ClientMapperEntity clientRole =
                mapper("client-role", ProtocolMapperTypes.CLIENT_ROLE, "clientRoles", null, 8);
        ClientMapperEntity unsupported =
                mapper("unsupported", "unsupported", "unsupported", null, 9);
        ClientMapperEntity nonBlankAudience =
                mapper("audience", ProtocolMapperTypes.AUDIENCE, null, "orders-api", 1);
        ClientMapperEntity blankAudience =
                mapper("blank-audience", ProtocolMapperTypes.AUDIENCE, null, " ", 2);
        ClientMapperRepository mapperRepository = mock(ClientMapperRepository.class);
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-id"))
                .thenReturn(
                        List.of(
                                nonBlankAudience,
                                blankAudience,
                                unknownProperty,
                                blankAttribute,
                                groups,
                                groupAttribute,
                                applicationRole,
                                clientRole,
                                unsupported));
        ClientScopeRepository scopeRepository = mock(ClientScopeRepository.class);
        when(scopeRepository.findByNameIn(Set.of("scope"))).thenReturn(List.of());
        JwtClaimsSet.Builder claims =
                JwtClaimsSet.builder().claim("sub", "admin").claim("aud", List.of("existing", 42));

        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        scopeRepository,
                        mapperRepository,
                        mock(ClientScopeMapperRepository.class),
                        null,
                        null,
                        null,
                        null)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "demo-client",
                                Set.of("scope")));

        assertThat(claims.build().getClaims())
                .containsEntry("aud", List.of("existing", "orders-api"))
                .containsEntry("groups", List.of())
                .containsEntry("roles", Set.of())
                .containsEntry("clientRoles", Set.of())
                .doesNotContainKeys("unknown", "attribute", "unsupported");
    }

    @Test
    @SuppressWarnings("unchecked")
    void mapsUserPropertyVariantsAndMultipleAttributeValues() {
        UserEntity user = new UserEntity();
        user.setId(42L);
        user.setUsername("admin");
        user.setFirstName("Ada");
        user.setLastName("Lovelace");
        user.setEmail("ada@example.test");
        user.setPreferredLocale("tr");
        GroupEntity group = new GroupEntity();
        group.setName("engineering");
        group.setAttributes(
                Set.of(
                        new GroupAttribute("department", "platform"),
                        new GroupAttribute("department", "security")));
        user.setGroups(Set.of(group));
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));

        UserProfileAttributeDefinitionEntity definition =
                new UserProfileAttributeDefinitionEntity();
        definition.setName("departmentCode");
        UserProfileAttributeRepository attributeRepository =
                mock(UserProfileAttributeRepository.class);
        when(attributeRepository
                        .findAllByUserIdOrderByDefinitionDisplayOrderAscDefinitionNameAscPositionAsc(
                                42L))
                .thenReturn(
                        List.of(
                                new UserProfileAttributeEntity(user, definition, 0, "PLATFORM"),
                                new UserProfileAttributeEntity(user, definition, 1, "SECURITY")));

        List<ClientMapperEntity> mappers = new java.util.ArrayList<>();
        for (String source : List.of("username", "lastName", "email", "preferredLocale")) {
            ClientMapperEntity mapper =
                    mapper(source, ProtocolMapperTypes.USER_PROPERTY, source, null, mappers.size());
            mapper.setSource(source);
            mappers.add(mapper);
        }
        ClientMapperEntity customAttribute =
                mapper("profile-attribute", ProtocolMapperTypes.USER_ATTRIBUTE, "codes", null, 4);
        customAttribute.setSource("departmentCode");
        mappers.add(customAttribute);
        ClientMapperEntity groupAttribute =
                mapper(
                        "group-attribute",
                        ProtocolMapperTypes.GROUP_ATTRIBUTE,
                        "departments",
                        null,
                        5);
        groupAttribute.setSource("department");
        mappers.add(groupAttribute);
        ClientMapperRepository mapperRepository = mock(ClientMapperRepository.class);
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-id"))
                .thenReturn(mappers);

        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");
        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        null,
                        mapperRepository,
                        null,
                        null,
                        attributeRepository,
                        null,
                        null)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "client-id",
                                Set.of()));

        assertThat(claims.build().getClaims())
                .containsEntry("username", "admin")
                .containsEntry("lastName", "Lovelace")
                .containsEntry("email", "ada@example.test")
                .containsEntry("preferredLocale", "tr")
                .containsEntry("codes", List.of("PLATFORM", "SECURITY"));
        assertThat((List<String>) claims.build().getClaims().get("departments"))
                .containsExactlyInAnyOrder("platform", "security");
    }

    @Test
    @SuppressWarnings("unchecked")
    void filtersRealmAndClientRolesUsingConfiguredScopeMappings() {
        AuthorityEntity allowedRealmRole = new AuthorityEntity();
        allowedRealmRole.setName("ROLE_ALLOWED");
        AuthorityEntity deniedRealmRole = new AuthorityEntity();
        deniedRealmRole.setName("ROLE_DENIED");
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setClientId("client-id");
        ClientRoleEntity allowedClientRole = new ClientRoleEntity(client, "read", null);
        ClientRoleEntity deniedClientRole = new ClientRoleEntity(client, "write", null);
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        user.setAuthorities(Set.of(allowedRealmRole, deniedRealmRole));
        user.setClientRoles(Set.of(allowedClientRole, deniedClientRole));
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));

        ClientScopeEntity scope = new ClientScopeEntity();
        AuthorityEntity scopedRealmRole = new AuthorityEntity();
        scopedRealmRole.setName("ROLE_ALLOWED");
        scope.setApplicationRoles(Set.of(scopedRealmRole));
        scope.setClientRoles(Set.of(new ClientRoleEntity(client, "read", null)));
        ClientScopeRepository scopeRepository = mock(ClientScopeRepository.class);
        when(scopeRepository.findByNameIn(anySet())).thenReturn(List.of(scope));
        when(scopeRepository.findDetailedByNameIn(anySet())).thenReturn(List.of(scope));

        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");
        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        scopeRepository,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "client-id",
                                Set.of("roles", "scope")));

        Map<String, Object> tokenClaims = claims.build().getClaims();
        assertThat((Map<String, Object>) tokenClaims.get("realm_access"))
                .containsEntry("roles", List.of("ROLE_ALLOWED"));
        assertThat((Map<String, Object>) tokenClaims.get("resource_access"))
                .containsEntry("client-id", Map.of("roles", List.of("read")));
    }

    @Test
    void appliesClientMappersOnlyToTheirConfiguredTokenTypes() {
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        ClientMapperEntity idOnly =
                mapper("id-only", ProtocolMapperTypes.HARDCODED_CLAIM, "idClaim", "id", 1);
        idOnly.setAddToIdToken(true);
        idOnly.setAddToAccessToken(false);
        ClientMapperEntity accessOnly =
                mapper(
                        "access-only",
                        ProtocolMapperTypes.HARDCODED_CLAIM,
                        "accessClaim",
                        "access",
                        2);
        accessOnly.setAddToIdToken(false);
        ClientMapperEntity neither =
                mapper("neither", ProtocolMapperTypes.HARDCODED_CLAIM, "neither", "no", 3);
        neither.setAddToIdToken(false);
        neither.setAddToAccessToken(false);
        ClientMapperRepository mapperRepository = mock(ClientMapperRepository.class);
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-id"))
                .thenReturn(List.of(idOnly, accessOnly, neither));
        var customizer =
                config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        null,
                        mapperRepository,
                        null,
                        null,
                        null,
                        null,
                        null);

        JwtClaimsSet.Builder idClaims = JwtClaimsSet.builder().claim("sub", "admin");
        customizer.customize(
                jwtContext(
                        idClaims,
                        new OAuth2TokenType(OidcParameterNames.ID_TOKEN),
                        AuthorizationGrantType.AUTHORIZATION_CODE,
                        "client-id",
                        Set.of()));
        assertThat(idClaims.build().getClaims())
                .containsEntry("idClaim", "id")
                .doesNotContainKeys("accessClaim", "neither");

        JwtClaimsSet.Builder accessClaims = JwtClaimsSet.builder().claim("sub", "admin");
        customizer.customize(
                jwtContext(
                        accessClaims,
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.AUTHORIZATION_CODE,
                        "client-id",
                        Set.of()));
        assertThat(accessClaims.build().getClaims())
                .containsEntry("accessClaim", "access")
                .doesNotContainKeys("idClaim", "neither");
    }

    @Test
    void usesStoredPictureAndSkipsBlankLocaleAndEmail() {
        UserEntity user = new UserEntity();
        user.setId(42L);
        user.setPictureUrl("https://profile.example/avatar.png");
        user.setEmail("");
        user.setPreferredLocale(" ");
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        when(avatarRepository.findVersionByUserId(42L)).thenReturn(Optional.empty());
        AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder();

        config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "account-console",
                                Set.of("email", "profile")));

        assertThat(claims.build().getClaims())
                .containsEntry("picture", "https://profile.example/avatar.png")
                .containsEntry("email", "")
                .containsEntry("email_verified", false)
                .doesNotContainKey("locale");
    }

    @Test
    void addsCibaRequestAndTokenHashesForSupportedSigningAlgorithms() {
        UserRepository userRepository = mock(UserRepository.class);
        UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        RegisteredClient client =
                RegisteredClient.withId("ciba-id")
                        .clientId("ciba-client")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                        .scope("openid")
                        .build();
        OAuth2ClientAuthenticationToken clientPrincipal =
                new OAuth2ClientAuthenticationToken(
                        client, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret");
        CibaAuthenticationGrantAuthenticationToken grant =
                new CibaAuthenticationGrantAuthenticationToken(
                        "auth-req-id",
                        clientPrincipal,
                        Map.of(
                                CibaAuthenticationGrantAuthenticationToken.ACR_VALUES_ATTRIBUTE,
                                "loa2 loa3",
                                CibaAuthenticationGrantAuthenticationToken.ACCESS_TOKEN_VALUE,
                                "access-token",
                                CibaAuthenticationGrantAuthenticationToken.REFRESH_TOKEN_VALUE,
                                "refresh-token"));

        for (SignatureAlgorithm algorithm :
                List.of(
                        SignatureAlgorithm.RS256,
                        SignatureAlgorithm.ES384,
                        SignatureAlgorithm.ES512)) {
            JwtClaimsSet.Builder claims = JwtClaimsSet.builder();
            config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                    .customize(cibaJwtContext(claims, client, grant, algorithm));

            assertThat(claims.build().getClaims())
                    .containsEntry(
                            CibaAuthenticationGrantAuthenticationToken.AUTH_REQ_ID_CLAIM,
                            "auth-req-id")
                    .containsEntry("acr", "loa2")
                    .containsKey("at_hash")
                    .containsKey("urn:openid:params:jwt:claim:rt_hash");
        }
    }

    @Test
    void skipsCibaOptionalClaimsWhenGrantParametersAreAbsent() {
        RegisteredClient client =
                RegisteredClient.withId("ciba-empty-id")
                        .clientId("ciba-empty-client")
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                        .build();
        CibaAuthenticationGrantAuthenticationToken grant =
                new CibaAuthenticationGrantAuthenticationToken("auth-req-id", mock(), Map.of());
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder();

        config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class))
                .customize(cibaJwtContext(claims, client, grant, SignatureAlgorithm.RS256));

        assertThat(claims.build().getClaims())
                .containsEntry(
                        CibaAuthenticationGrantAuthenticationToken.AUTH_REQ_ID_CLAIM, "auth-req-id")
                .doesNotContainKeys("acr", "at_hash", "urn:openid:params:jwt:claim:rt_hash");
    }

    @Test
    void skipsBlankCibaAcrAndTokenHashesForAccessTokens() {
        RegisteredClient client =
                RegisteredClient.withId("ciba-blank-id")
                        .clientId("ciba-blank-client")
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                        .build();
        CibaAuthenticationGrantAuthenticationToken grant =
                new CibaAuthenticationGrantAuthenticationToken(
                        "auth-req-id",
                        mock(),
                        Map.of(
                                CibaAuthenticationGrantAuthenticationToken.ACR_VALUES_ATTRIBUTE,
                                "  "));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder();

        config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class))
                .customize(
                        JwtEncodingContext.with(JwsHeader.with(SignatureAlgorithm.RS256), claims)
                                .registeredClient(client)
                                .principal(
                                        new UsernamePasswordAuthenticationToken(
                                                "admin", "n/a", List.of()))
                                .authorizedScopes(Set.of("openid"))
                                .tokenType(OAuth2TokenType.ACCESS_TOKEN)
                                .authorizationGrantType(
                                        new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                                .authorizationGrant(grant)
                                .build());

        assertThat(claims.build().getClaims())
                .containsEntry(
                        CibaAuthenticationGrantAuthenticationToken.AUTH_REQ_ID_CLAIM, "auth-req-id")
                .doesNotContainKeys("acr", "at_hash", "urn:openid:params:jwt:claim:rt_hash");
    }

    @Test
    void skipsDpopBindingWhenConfidentialRefreshOnlyProofIsConfigured() {
        Map<String, Object> jwk = Map.of("kty", "oct", "k", "c2VjcmV0");
        Jwt proof =
                new Jwt(
                        "proof",
                        Instant.now().minusSeconds(1),
                        Instant.now().plusSeconds(60),
                        Map.of("jwk", jwk),
                        Map.of("htm", "GET"));
        RegisteredClient client =
                RegisteredClient.withId("refresh-only-id")
                        .clientId("refresh-only-client")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                        .clientSettings(
                                ClientSettings.builder()
                                        .setting(
                                                ClientSecuritySettings.DPOP_REFRESH_TOKEN_ONLY,
                                                true)
                                        .build())
                        .build();
        JwtEncodingContext context =
                dpopContext(
                        client,
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.REFRESH_TOKEN,
                        proof);
        context.getClaims().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class))
                .customize(context);

        assertThat(context.getClaims().build().getClaims()).doesNotContainKey("cnf");
    }

    @Test
    void mapsAccessTokenSocialClaims() {
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        SocialIdentityEntity identity = new SocialIdentityEntity();
        identity.setMappedClaims("{\"access_token\":{\"tenant\":\"acme\"}}");
        SocialIdentityRepository socialIdentityRepository = mock(SocialIdentityRepository.class);
        when(socialIdentityRepository.findAllByUserUsername("admin")).thenReturn(List.of(identity));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        null,
                        socialIdentityRepository,
                        new ObjectMapper())
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "account-console",
                                Set.of("openid")));

        assertThat(claims.build().getClaims()).containsEntry("tenant", "acme");
    }

    @Test
    void mapsParentGroupPathAndPartialFullName() {
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        user.setFirstName("Ada");
        user.setLastName(" ");
        GroupEntity parent = new GroupEntity();
        parent.setName("Platform");
        GroupEntity child = new GroupEntity();
        child.setName("Operations");
        child.setParent(parent);
        user.setGroups(Set.of(child));
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        ClientMapperRepository mapperRepository = mock(ClientMapperRepository.class);
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-id"))
                .thenReturn(
                        List.of(
                                mapper(
                                        "groups",
                                        ProtocolMapperTypes.GROUP_MEMBERSHIP,
                                        "groups",
                                        null,
                                        1),
                                mapper(
                                        "full-name",
                                        ProtocolMapperTypes.FULL_NAME,
                                        "fullName",
                                        null,
                                        2)));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        null,
                        mapperRepository,
                        null,
                        null,
                        null,
                        null,
                        null)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "client-id",
                                Set.of("openid")));

        assertThat(claims.build().getClaims())
                .containsEntry("groups", List.of("/Platform/Operations"))
                .containsEntry("fullName", "Ada");
    }

    @Test
    void keepsApplicationRolesWhenScopeRoleMappingIsUnconfigured() {
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        user.setAuthorities(Set.of(new AuthorityEntity(1L, "ROLE_USER")));
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        ClientScopeEntity scope = new ClientScopeEntity();
        scope.setName("roles");
        ClientScopeRepository scopeRepository = mock(ClientScopeRepository.class);
        when(scopeRepository.findByNameIn(Set.of("roles"))).thenReturn(List.of());
        when(scopeRepository.findDetailedByNameIn(Set.of("roles"))).thenReturn(List.of(scope));
        ClientMapperRepository mapperRepository = mock(ClientMapperRepository.class);
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-id"))
                .thenReturn(List.of());
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        scopeRepository,
                        mapperRepository,
                        null,
                        null,
                        null,
                        null,
                        null)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "client-id",
                                Set.of("roles")));

        assertThat(claims.build().getClaims())
                .containsEntry("realm_access", Map.of("roles", List.of("ROLE_USER")));
    }

    @Test
    void acceptsDpopProofForAuthorizationWithoutJktRequirement() {
        Map<String, Object> jwk = Map.of("kty", "oct", "k", "c2VjcmV0");
        Jwt proof =
                new Jwt(
                        "proof",
                        Instant.now().minusSeconds(1),
                        Instant.now().plusSeconds(60),
                        Map.of("jwk", jwk),
                        Map.of("htm", "GET"));
        RegisteredClient client =
                RegisteredClient.withId("dpop-client-credentials")
                        .clientId("dpop-client-credentials")
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .clientSettings(
                                ClientSettings.builder()
                                        .setting(ClientSecuritySettings.REQUIRE_DPOP_JKT, true)
                                        .build())
                        .build();
        JwtEncodingContext context =
                dpopContext(
                        client,
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.CLIENT_CREDENTIALS,
                        proof);

        config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class))
                .customize(context);

        assertThat(context.getClaims().build().getClaims()).containsKey("cnf");
    }

    @Test
    void classifiesTokenTypesAcrossGrantAndScopeCombinations() {
        JwtEncodingContext authorizationCode =
                jwtContext(
                        JwtClaimsSet.builder(),
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.AUTHORIZATION_CODE,
                        "account-console",
                        Set.of("profile", "email", "roles"));
        JwtEncodingContext refresh =
                jwtContext(
                        JwtClaimsSet.builder(),
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.REFRESH_TOKEN,
                        "account-console",
                        Set.of("profile", "email", "roles"));
        JwtEncodingContext ciba =
                cibaJwtContext(
                        JwtClaimsSet.builder(),
                        RegisteredClient.withId("ciba")
                                .clientId("ciba")
                                .authorizationGrantType(
                                        new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                                .build(),
                        new CibaAuthenticationGrantAuthenticationToken("req", mock(), Map.of()),
                        SignatureAlgorithm.RS256);
        JwtEncodingContext clientCredentials =
                jwtContextWithoutAuthorization(
                        JwtClaimsSet.builder(),
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.CLIENT_CREDENTIALS,
                        "api",
                        Set.of());

        for (JwtEncodingContext context :
                List.of(authorizationCode, refresh, ciba, clientCredentials)) {
            invokeTokenPredicate("isUserProfileToken", context);
            invokeTokenPredicate("isUserEmailToken", context);
            invokeTokenPredicate("isUserLocaleToken", context);
            invokeTokenPredicate("isUserSocialClaimsToken", context);
            invokeTokenPredicate("isRoleToken", context);
        }
        assertThat(invokeTokenPredicate("isUserProfileToken", authorizationCode)).isTrue();
        assertThat(invokeTokenPredicate("isUserEmailToken", authorizationCode)).isTrue();
        assertThat(invokeTokenPredicate("isRoleToken", authorizationCode)).isTrue();
        assertThat(invokeTokenPredicate("isUserLocaleToken", clientCredentials)).isFalse();
    }

    private static boolean invokeTokenPredicate(String name, JwtEncodingContext context) {
        try {
            Method method =
                    AuthorizationServerConfig.class.getDeclaredMethod(
                            name, JwtEncodingContext.class);
            method.setAccessible(true);
            return (Boolean) method.invoke(null, context);
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError(exception);
        }
    }

    private static JwtEncodingContext cibaJwtContext(
            JwtClaimsSet.Builder claims,
            RegisteredClient client,
            CibaAuthenticationGrantAuthenticationToken grant,
            SignatureAlgorithm algorithm) {
        UsernamePasswordAuthenticationToken principal =
                new UsernamePasswordAuthenticationToken("admin", "n/a", List.of());
        return JwtEncodingContext.with(JwsHeader.with(algorithm), claims)
                .registeredClient(client)
                .principal(principal)
                .authorizedScopes(Set.of("openid", "profile", "email", "roles"))
                .tokenType(new OAuth2TokenType(OidcParameterNames.ID_TOKEN))
                .authorizationGrantType(new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                .authorizationGrant(grant)
                .build();
    }

    @Test
    void mapsConfiguredGroupScopeClaims() {
        UserEntity user = new UserEntity();
        GroupEntity group = new GroupEntity();
        group.setName("engineering");
        user.setGroups(Set.of(group));
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        final UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        final AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        ClientScopeEntity mapper = new ClientScopeEntity();
        mapper.setName("groups");
        mapper.setGroupMapperEnabled(true);
        mapper.setGroupClaimName("teams");
        mapper.setGroupMapperFullPath(false);
        ClientScopeRepository clientScopeRepository = mock(ClientScopeRepository.class);
        when(clientScopeRepository.findByNameIn(Set.of("groups"))).thenReturn(List.of(mapper));
        SocialIdentityRepository socialIdentityRepository = mock(SocialIdentityRepository.class);
        when(socialIdentityRepository.findAllByUserUsername("admin")).thenReturn(List.of());
        ObjectMapper objectMapper = mock(ObjectMapper.class);
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder();

        config.jwtTokenCustomizer(
                        userRepository,
                        avatarRepository,
                        authorizationRepository,
                        clientScopeRepository,
                        socialIdentityRepository,
                        objectMapper)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "account-console",
                                Set.of("groups")));

        assertThat(claims.build().getClaims()).containsEntry("teams", List.of("engineering"));
    }

    @Test
    void mapsFullGroupPathsAndSocialClaimsForAccessToken() {
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        GroupEntity parent = new GroupEntity();
        parent.setName("platform");
        GroupEntity child = new GroupEntity();
        child.setName("engineering");
        child.setParent(parent);
        user.setGroups(Set.of(child));
        final UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        final UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        final AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        ClientScopeEntity mapper = new ClientScopeEntity();
        mapper.setName("groups");
        mapper.setGroupMapperEnabled(true);
        mapper.setGroupClaimName("teams");
        mapper.setGroupMapperFullPath(true);
        ClientScopeRepository clientScopeRepository = mock(ClientScopeRepository.class);
        when(clientScopeRepository.findByNameIn(Set.of("groups"))).thenReturn(List.of(mapper));
        SocialIdentityEntity identity = new SocialIdentityEntity();
        identity.setMappedClaims("{\"access_token\":{\"tenant\":\"acme\"}}");
        SocialIdentityRepository socialIdentityRepository = mock(SocialIdentityRepository.class);
        when(socialIdentityRepository.findAllByUserUsername("admin")).thenReturn(List.of(identity));
        ObjectMapper objectMapper = new ObjectMapper();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        userRepository,
                        avatarRepository,
                        authorizationRepository,
                        clientScopeRepository,
                        socialIdentityRepository,
                        objectMapper)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.REFRESH_TOKEN,
                                "account-console",
                                Set.of("groups")));

        assertThat(claims.build().getClaims())
                .containsEntry("teams", List.of("/platform/engineering"))
                .containsEntry("tenant", "acme");
    }

    @Test
    void ignoresMalformedAndEmptyMappedClaims() throws Exception {
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        final UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        final UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        final AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        SocialIdentityEntity blank = new SocialIdentityEntity();
        blank.setMappedClaims(" ");
        SocialIdentityEntity malformed = new SocialIdentityEntity();
        malformed.setMappedClaims("malformed");
        SocialIdentityRepository socialIdentityRepository = mock(SocialIdentityRepository.class);
        when(socialIdentityRepository.findAllByUserUsername("admin"))
                .thenReturn(List.of(blank, malformed));
        ObjectMapper objectMapper = mock(ObjectMapper.class);
        when(objectMapper.readValue(
                        ArgumentMatchers.eq("malformed"),
                        ArgumentMatchers
                                .<tools.jackson.core.type.TypeReference<
                                                Map<String, Map<String, Object>>>>
                                        any()))
                .thenThrow(new IllegalArgumentException("bad mapper"));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        userRepository,
                        avatarRepository,
                        authorizationRepository,
                        null,
                        socialIdentityRepository,
                        objectMapper)
                .customize(
                        jwtContext(
                                claims,
                                new OAuth2TokenType(OidcParameterNames.ID_TOKEN),
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "account-console",
                                Set.of("openid")));

        assertThat(claims.build().getClaims()).doesNotContainKey("tenant");
        verify(objectMapper)
                .readValue(
                        ArgumentMatchers.eq("malformed"),
                        ArgumentMatchers
                                .<tools.jackson.core.type.TypeReference<
                                                Map<String, Map<String, Object>>>>
                                        any());
    }

    @Test
    void skipsSocialClaimsWhenMappedTokenSectionIsAbsent() {
        UserEntity user = new UserEntity();
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        SocialIdentityEntity identity = new SocialIdentityEntity();
        identity.setMappedClaims("{\"access_token\":{\"tenant\":\"acme\"}}");
        SocialIdentityRepository socialIdentityRepository = mock(SocialIdentityRepository.class);
        when(socialIdentityRepository.findAllByUserUsername("admin")).thenReturn(List.of(identity));
        ObjectMapper objectMapper = new ObjectMapper();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        null,
                        socialIdentityRepository,
                        objectMapper)
                .customize(
                        jwtContext(
                                claims,
                                new OAuth2TokenType(OidcParameterNames.ID_TOKEN),
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "account-console",
                                Set.of("openid")));

        assertThat(claims.build().getClaims()).doesNotContainKey("tenant");
    }

    @Test
    void omitsSessionIdentifierWhenAuthorizationIsMissing() {
        final UserRepository userRepository = mock(UserRepository.class);
        final UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        final AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder();

        config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                .customize(
                        jwtContextWithoutAuthorization(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.CLIENT_CREDENTIALS,
                                "admin-console",
                                Set.of()));

        assertThat(claims.build().getClaims()).doesNotContainKey("sid");
        verify(authorizationRepository, never()).findSessionIdById(ArgumentMatchers.anyString());
    }

    @Test
    void handlesMissingUsersAndMissingAuthorizationSessions() {
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.empty());
        UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        when(authorizationRepository.findSessionIdById("authorization-id"))
                .thenReturn(Optional.empty());
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "admin-console",
                                Set.of("profile", "email")));

        assertThat(claims.build().getClaims())
                .containsEntry("roles", List.of("ROLE_ADMIN", "ROLE_USER"))
                .doesNotContainKeys("picture", "email", "locale", "groups", "sid");
        verify(avatarRepository, never()).findVersionByUserId(ArgumentMatchers.anyLong());
    }

    @Test
    void mapsSocialClaimsForOidcIdToken() {
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        SocialIdentityEntity identity = new SocialIdentityEntity();
        identity.setMappedClaims("{\"id_token\":{\"tenant\":\"acme\"}}");
        SocialIdentityRepository socialIdentityRepository = mock(SocialIdentityRepository.class);
        when(socialIdentityRepository.findAllByUserUsername("admin")).thenReturn(List.of(identity));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        mock(ClientScopeRepository.class),
                        socialIdentityRepository,
                        new ObjectMapper())
                .customize(
                        jwtContext(
                                claims,
                                new OAuth2TokenType(OidcParameterNames.ID_TOKEN),
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "account-console",
                                Set.of("openid")));

        assertThat(claims.build().getClaims()).containsEntry("tenant", "acme");
    }

    @Test
    void coversIdTokenClaimBranchesAndOptionalSocialPayloads() {
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        user.setPictureUrl(" ");
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        when(avatarRepository.findVersionByUserId(null)).thenReturn(Optional.empty());
        AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        SocialIdentityEntity identity = new SocialIdentityEntity();
        identity.setMappedClaims(null);
        SocialIdentityRepository socialIdentityRepository = mock(SocialIdentityRepository.class);
        when(socialIdentityRepository.findAllByUserUsername("admin")).thenReturn(List.of(identity));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        userRepository,
                        avatarRepository,
                        authorizationRepository,
                        mock(ClientScopeRepository.class),
                        socialIdentityRepository,
                        new ObjectMapper())
                .customize(
                        jwtContext(
                                claims,
                                new OAuth2TokenType(OidcParameterNames.ID_TOKEN),
                                AuthorizationGrantType.REFRESH_TOKEN,
                                "account-console",
                                Set.of("profile", "email", "openid"),
                                " "));

        assertThat(claims.build().getClaims())
                .doesNotContainKeys("picture", "email", "locale", "nonce");

        JwtClaimsSet.Builder noAuthorizationClaims = JwtClaimsSet.builder().claim("sub", "admin");
        config.jwtTokenCustomizer(
                        userRepository,
                        avatarRepository,
                        authorizationRepository,
                        null,
                        socialIdentityRepository,
                        new ObjectMapper())
                .customize(
                        jwtContextWithoutAuthorization(
                                noAuthorizationClaims,
                                new OAuth2TokenType(OidcParameterNames.ID_TOKEN),
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "account-console",
                                Set.of("openid")));
        assertThat(noAuthorizationClaims.build().getClaims()).doesNotContainKey("nonce");
    }

    @Test
    void skipsUserClaimsWhenScopesUseAnUnsupportedGrant() {
        final UserRepository userRepository = mock(UserRepository.class);
        final UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        final AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "client");

        config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                .customize(
                        jwtContextWithoutAuthorization(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.CLIENT_CREDENTIALS,
                                "other-client",
                                Set.of("profile", "email", "openid")));

        verify(userRepository, never()).findByUsername(anyString());
        assertThat(claims.build().getClaims()).doesNotContainKeys("picture", "email", "locale");
    }

    @Test
    void skipsMappedClaimsWhenEligibleTokenHasNoUser() {
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());
        SocialIdentityRepository socialIdentityRepository = mock(SocialIdentityRepository.class);
        ObjectMapper objectMapper = new ObjectMapper();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "missing");

        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        null,
                        socialIdentityRepository,
                        objectMapper)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "account-console",
                                Set.of("openid")));

        verify(socialIdentityRepository, never()).findAllByUserUsername(anyString());
    }

    @Test
    void coversNonMatchingTokenPredicatesAndDisabledGroupScopes() {
        final UserRepository userRepository = mock(UserRepository.class);
        final UserAvatarRepository avatarRepository = mock(UserAvatarRepository.class);
        final AuthorizationRepository authorizationRepository = mock(AuthorizationRepository.class);
        ClientScopeRepository clientScopeRepository = mock(ClientScopeRepository.class);
        ClientScopeEntity disabledMapper = new ClientScopeEntity();
        disabledMapper.setName("groups");
        disabledMapper.setGroupMapperEnabled(false);
        when(clientScopeRepository.findByNameIn(Set.of("groups")))
                .thenReturn(List.of(disabledMapper));

        JwtClaimsSet.Builder customClaims = JwtClaimsSet.builder().claim("sub", "client");
        config.jwtTokenCustomizer(
                        userRepository,
                        avatarRepository,
                        authorizationRepository,
                        clientScopeRepository,
                        null,
                        null)
                .customize(
                        jwtContextWithoutAuthorization(
                                customClaims,
                                new OAuth2TokenType("custom"),
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "other-client",
                                Set.of("groups")));

        assertThat(customClaims.build().getClaims()).containsEntry("sub", "client");
        verify(userRepository, never()).findByUsername(anyString());

        when(userRepository.findByUsername("admin")).thenReturn(Optional.empty());
        JwtClaimsSet.Builder adminClaims = JwtClaimsSet.builder().claim("sub", "admin");
        config.jwtTokenCustomizer(userRepository, avatarRepository, authorizationRepository)
                .customize(
                        jwtContextWithoutAuthorization(
                                adminClaims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.CLIENT_CREDENTIALS,
                                "admin-console",
                                Set.of()));

        assertThat(adminClaims.build().getClaims()).containsEntry("roles", List.of());
    }

    @Test
    void skipsScopeMappersWhenAuthorizedScopesAreEmptyOrUnmapped() {
        ClientMapperRepository mapperRepository = mock(ClientMapperRepository.class);
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-id"))
                .thenReturn(List.of());
        ClientScopeRepository scopeRepository = mock(ClientScopeRepository.class);
        ClientScopeMapperRepository scopeMapperRepository = mock(ClientScopeMapperRepository.class);
        when(scopeRepository.findByNameIn(Set.of("missing"))).thenReturn(List.of());
        UserRepository userRepository = mock(UserRepository.class);
        JwtClaimsSet.Builder emptyScopes = JwtClaimsSet.builder().claim("sub", "admin");

        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        scopeRepository,
                        mapperRepository,
                        scopeMapperRepository,
                        null,
                        null,
                        null,
                        null)
                .customize(
                        jwtContext(
                                emptyScopes,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "client-id",
                                Set.of()));

        JwtClaimsSet.Builder unmappedScope = JwtClaimsSet.builder().claim("sub", "admin");
        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        scopeRepository,
                        mapperRepository,
                        scopeMapperRepository,
                        null,
                        null,
                        null,
                        null)
                .customize(
                        jwtContext(
                                unmappedScope,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "client-id",
                                Set.of("missing")));

        verify(scopeMapperRepository, never())
                .findAllByClientScopeIdInOrderByPriorityAscNameAsc(ArgumentMatchers.anyList());
    }

    @Test
    void bindsDpopProofWhenRefreshRequiresProofAndClientAuthenticationIsPublic() {
        Map<String, Object> jwk = Map.of("kty", "oct", "k", "c2VjcmV0");
        Jwt proof =
                new Jwt(
                        "proof",
                        Instant.now().minusSeconds(1),
                        Instant.now().plusSeconds(60),
                        Map.of("jwk", jwk),
                        Map.of("htm", "GET"));
        RegisteredClient client =
                RegisteredClient.withId("refresh-proof-id")
                        .clientId("refresh-proof-client")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                        .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                        .clientSettings(
                                ClientSettings.builder()
                                        .setting(
                                                ClientSecuritySettings.DPOP_REFRESH_TOKEN_ONLY,
                                                true)
                                        .setting(ClientSecuritySettings.REQUIRE_DPOP_PROOF, true)
                                        .build())
                        .build();

        JwtEncodingContext context =
                dpopContext(
                        client,
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.REFRESH_TOKEN,
                        proof);
        config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class))
                .customize(context);

        assertThat(context.getClaims().build().getClaims()).containsKey("cnf");
    }

    @Test
    void rejectsDpopProofWhenAuthorizationRequestDoesNotContainExpectedJkt() {
        Map<String, Object> jwk = Map.of("kty", "oct", "k", "c2VjcmV0");
        Jwt proof =
                new Jwt(
                        "proof",
                        Instant.now().minusSeconds(1),
                        Instant.now().plusSeconds(60),
                        Map.of("jwk", jwk),
                        Map.of("htm", "GET"));
        RegisteredClient client =
                RegisteredClient.withId("missing-jkt-id")
                        .clientId("missing-jkt-client")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("http://localhost/callback")
                        .clientSettings(
                                ClientSettings.builder()
                                        .setting(ClientSecuritySettings.REQUIRE_DPOP_JKT, true)
                                        .build())
                        .build();
        OAuth2Authorization authorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .id("authorization-id")
                        .principalName("admin")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .build();
        JwtEncodingContext context =
                dpopContext(
                        client,
                        OAuth2TokenType.ACCESS_TOKEN,
                        AuthorizationGrantType.AUTHORIZATION_CODE,
                        proof,
                        authorization);
        var customizer =
                config.jwtTokenCustomizer(
                        mock(UserRepository.class),
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class));

        assertThatThrownBy(() -> customizer.customize(context))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    @Test
    void handlesNullGroupAttributesAndNullUserPropertySources() {
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        GroupEntity group = new GroupEntity();
        group.setName("engineering");
        group.setAttributes(null);
        user.setGroups(Set.of(group));
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        ClientMapperEntity nullProperty =
                mapper("null-property", ProtocolMapperTypes.USER_PROPERTY, "nullProperty", null, 1);
        nullProperty.setSource(null);
        ClientMapperEntity missingGroupAttribute =
                mapper(
                        "missing-group-attribute",
                        ProtocolMapperTypes.GROUP_ATTRIBUTE,
                        "missingGroupAttribute",
                        null,
                        2);
        missingGroupAttribute.setSource("department");
        ClientMapperRepository mapperRepository = mock(ClientMapperRepository.class);
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-id"))
                .thenReturn(List.of(nullProperty, missingGroupAttribute));

        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().claim("sub", "admin");
        config.jwtTokenCustomizer(
                        userRepository,
                        mock(UserAvatarRepository.class),
                        mock(AuthorizationRepository.class),
                        null,
                        mapperRepository,
                        null,
                        null,
                        null,
                        null,
                        null)
                .customize(
                        jwtContext(
                                claims,
                                OAuth2TokenType.ACCESS_TOKEN,
                                AuthorizationGrantType.AUTHORIZATION_CODE,
                                "client-id",
                                Set.of()));

        assertThat(claims.build().getClaims())
                .doesNotContainKeys("nullProperty", "missingGroupAttribute");
    }

    private static JwtEncodingContext jwtContext(
            JwtClaimsSet.Builder claims,
            OAuth2TokenType tokenType,
            AuthorizationGrantType grantType,
            String clientId,
            Set<String> scopes) {
        return jwtContext(claims, tokenType, grantType, clientId, scopes, null);
    }

    private static JwtEncodingContext jwtContext(
            JwtClaimsSet.Builder claims,
            OAuth2TokenType tokenType,
            AuthorizationGrantType grantType,
            String clientId,
            Set<String> scopes,
            String nonce) {
        RegisteredClient registeredClient =
                RegisteredClient.withId("client-id")
                        .clientId(clientId)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("https://client.example/callback")
                        .build();
        UsernamePasswordAuthenticationToken principal =
                new UsernamePasswordAuthenticationToken(
                        "admin",
                        "n/a",
                        List.of(
                                new SimpleGrantedAuthority("ROLE_USER"),
                                new SimpleGrantedAuthority("ROLE_ADMIN")));
        var authorizationBuilder =
                OAuth2Authorization.withRegisteredClient(registeredClient)
                        .id("authorization-id")
                        .principalName("admin")
                        .authorizationGrantType(grantType);
        Map<String, Object> additionalParameters =
                nonce == null ? Map.of() : Map.of(OidcParameterNames.NONCE, nonce);
        authorizationBuilder.attribute(
                OAuth2AuthorizationRequest.class.getName(),
                OAuth2AuthorizationRequest.authorizationCode()
                        .authorizationUri("https://issuer.example/oauth2/authorize")
                        .clientId(clientId)
                        .redirectUri("https://client.example/callback")
                        .scopes(scopes)
                        .state("state")
                        .additionalParameters(additionalParameters)
                        .build());
        OAuth2Authorization authorization = authorizationBuilder.build();
        return JwtEncodingContext.with(JwsHeader.with(SignatureAlgorithm.RS256), claims)
                .registeredClient(registeredClient)
                .authorization(authorization)
                .principal(principal)
                .authorizedScopes(scopes)
                .tokenType(tokenType)
                .authorizationGrantType(grantType)
                .build();
    }

    private static ClientMapperEntity mapper(
            String name, String type, String claimName, String value, int priority) {
        ClientMapperEntity mapper = new ClientMapperEntity();
        mapper.setName(name);
        mapper.setMapperType(type);
        mapper.setClaimName(claimName);
        mapper.setValue(value);
        mapper.setPriority(priority);
        mapper.setAddToAccessToken(true);
        return mapper;
    }

    private static JwtEncodingContext dpopContext(
            RegisteredClient registeredClient,
            OAuth2TokenType tokenType,
            AuthorizationGrantType grantType,
            Jwt proof) {
        return dpopContext(registeredClient, tokenType, grantType, proof, null);
    }

    private static JwtEncodingContext dpopContext(
            RegisteredClient registeredClient,
            OAuth2TokenType tokenType,
            AuthorizationGrantType grantType,
            Jwt proof,
            OAuth2Authorization authorization) {
        UsernamePasswordAuthenticationToken principal =
                new UsernamePasswordAuthenticationToken("admin", "n/a", List.of());
        JwtEncodingContext.Builder builder =
                JwtEncodingContext.with(
                                JwsHeader.with(SignatureAlgorithm.RS256), JwtClaimsSet.builder())
                        .registeredClient(registeredClient)
                        .principal(principal)
                        .authorizedScopes(Set.of())
                        .tokenType(tokenType)
                        .authorizationGrantType(grantType)
                        .put(OAuth2TokenContext.DPOP_PROOF_KEY, proof);
        if (authorization != null) {
            builder.authorization(authorization);
        }
        return builder.build();
    }

    private static JwtEncodingContext jwtContextWithoutAuthorization(
            JwtClaimsSet.Builder claims,
            OAuth2TokenType tokenType,
            AuthorizationGrantType grantType,
            String clientId,
            Set<String> scopes) {
        RegisteredClient registeredClient =
                RegisteredClient.withId("client-id")
                        .clientId(clientId)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .build();
        UsernamePasswordAuthenticationToken principal =
                new UsernamePasswordAuthenticationToken("admin", "n/a", List.of());
        return JwtEncodingContext.with(JwsHeader.with(SignatureAlgorithm.RS256), claims)
                .registeredClient(registeredClient)
                .principal(principal)
                .authorizedScopes(scopes)
                .tokenType(tokenType)
                .authorizationGrantType(grantType)
                .build();
    }

    private static ApplicationProperties applicationProperties() {
        return new ApplicationProperties(
                new ApplicationProperties.Cache(
                        new ApplicationProperties.Caffeine(
                                java.time.Duration.ofHours(1), 500, 1000)),
                new ApplicationProperties.Session("0 * * * * *"),
                new ApplicationProperties.AuthorizationServer("https://issuer.example"),
                new ApplicationProperties.Mail(
                        false, "no-reply@localhost", "https://issuer.example"));
    }

    private static HttpSecurity httpSecurity() {
        ObjectPostProcessor<Object> postProcessor =
                new ObjectPostProcessor<>() {
                    @Override
                    public <O> O postProcess(O object) {
                        return object;
                    }
                };
        final HttpSecurity httpSecurity =
                new HttpSecurity(
                        postProcessor,
                        new AuthenticationManagerBuilder(postProcessor),
                        new HashMap<>());
        StaticApplicationContext applicationContext = new StaticApplicationContext();
        applicationContext
                .getBeanFactory()
                .registerSingleton("pathPatternBuilder", PathPatternRequestMatcher.withDefaults());
        applicationContext
                .getBeanFactory()
                .registerSingleton(
                        "userDetailsService",
                        mock(
                                org.springframework.security.core.userdetails.UserDetailsService
                                        .class));
        applicationContext.getBeanFactory().registerSingleton("jwtDecoder", mock(JwtDecoder.class));
        applicationContext
                .getBeanFactory()
                .registerSingleton(
                        "authorizationServerSettings",
                        AuthorizationServerSettings.builder()
                                .issuer("https://issuer.example")
                                .build());
        applicationContext
                .getBeanFactory()
                .registerSingleton(
                        "registeredClientRepository", mock(RegisteredClientRepository.class));
        httpSecurity.setSharedObject(ApplicationContext.class, applicationContext);
        httpSecurity.setSharedObject(
                jakarta.servlet.ServletContext.class, new MockServletContext());
        httpSecurity.setSharedObject(
                PathPatternRequestMatcher.Builder.class, PathPatternRequestMatcher.withDefaults());
        httpSecurity.setSharedObject(JwtDecoder.class, mock(JwtDecoder.class));
        return httpSecurity;
    }
}
