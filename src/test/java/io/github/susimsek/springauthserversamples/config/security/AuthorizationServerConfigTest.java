package io.github.susimsek.springauthserversamples.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.domain.ClientRoleEntity;
import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.domain.SocialIdentityEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.repository.ClientScopeRepository;
import io.github.susimsek.springauthserversamples.repository.SocialIdentityRepository;
import io.github.susimsek.springauthserversamples.repository.UserAvatarRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthorizationEndpointErrorResponseHandler;
import io.github.susimsek.springauthserversamples.security.LocalizedOAuth2ErrorResponseHandler;
import io.github.susimsek.springauthserversamples.security.OAuth2KeyJwkSource;
import io.github.susimsek.springauthserversamples.service.OAuth2KeyService;
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
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
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
                        mock(RequiredActionAuthorizationFilter.class),
                        mock(MfaAuthorizationFilter.class),
                        mock(SocialProviderLogoutSuccessHandler.class),
                        mock(SecurityContextRepository.class));

        assertThat(chain).isNotNull();
        assertThat(chain.getFilters()).isNotEmpty();
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
                .containsEntry(
                        "sid",
                        io.github.susimsek.springauthserversamples.security.OidcSessionIdentifier
                                .fromSessionId("browser-session"));
        verify(userRepository).findByUsername("admin");
        verify(avatarRepository).findVersionByUserId(42L);
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
