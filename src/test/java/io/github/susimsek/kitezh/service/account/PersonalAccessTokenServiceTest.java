package io.github.susimsek.kitezh.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.PersonalAccessTokenEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.PersonalAccessTokenDTO;
import io.github.susimsek.kitezh.dto.account.PersonalAccessTokenRequestDTO;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.PersonalAccessTokenRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContext;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

@ExtendWith(MockitoExtension.class)
class PersonalAccessTokenServiceTest {

    private static final String USERNAME = "pat-user";

    @Mock private PersonalAccessTokenRepository personalAccessTokenRepository;
    @Mock private UserRepository userRepository;
    @Mock private AuthorizationRepository authorizationRepository;
    @Mock private RegisteredClientRepository registeredClientRepository;

    @Mock
    private org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService
            authorizationService;

    @Mock private OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator;
    @Mock private UserDetailsService userDetailsService;
    @Mock private AuthorizationServerSettings authorizationServerSettings;
    @Mock private AdminAuditEventService auditEventService;
    @InjectMocks private PersonalAccessTokenService service;

    @Test
    void rejectsCreationWhenTheAccountHasReachedItsTokenLimit() {
        when(personalAccessTokenRepository.countActiveByUsername(any(), any())).thenReturn(50L);

        assertThatThrownBy(() -> service.create(USERNAME, request("30")))
                .isInstanceOf(ApiException.class)
                .hasMessage("The account has reached its token limit");
    }

    @Test
    void failsWhenThePersonalAccessTokenClientIsMissing() {
        when(personalAccessTokenRepository.countActiveByUsername(any(), any())).thenReturn(0L);
        when(registeredClientRepository.findByClientId(PersonalAccessTokenService.CLIENT_ID))
                .thenReturn(null);

        assertThatThrownBy(() -> service.create(USERNAME, request("30")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Personal access token client is not configured");
    }

    @Test
    void createsTokenWithCustomExpirationAndNormalizesBlankDescription() {
        RegisteredClient client =
                RegisteredClient.withId("pat-client")
                        .clientId(PersonalAccessTokenService.CLIENT_ID)
                        .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                        .authorizationGrantType(
                                new AuthorizationGrantType(
                                        PersonalAccessTokenService.GRANT_TYPE_VALUE))
                        .scope(PersonalAccessTokenService.SCOPE)
                        .build();
        var user = User.withUsername(USERNAME).password("unused").roles("USER").build();
        UserEntity userEntity = new UserEntity();
        userEntity.setUsername(USERNAME);
        Instant now = Instant.now();
        OAuth2AccessToken accessToken =
                new OAuth2AccessToken(
                        OAuth2AccessToken.TokenType.BEARER,
                        "one-time-secret",
                        now,
                        now.plusSeconds(300),
                        java.util.Set.of(PersonalAccessTokenService.SCOPE));
        when(personalAccessTokenRepository.countActiveByUsername(any(), any())).thenReturn(0L);
        when(registeredClientRepository.findByClientId(PersonalAccessTokenService.CLIENT_ID))
                .thenReturn(client);
        when(userDetailsService.loadUserByUsername(USERNAME)).thenReturn(user);
        when(userRepository.findByUsername(USERNAME)).thenReturn(java.util.Optional.of(userEntity));
        doReturn(accessToken).when(tokenGenerator).generate(any());

        var created =
                service.create(
                        USERNAME,
                        new PersonalAccessTokenRequestDTO(
                                "  Codex  ",
                                "  ",
                                "custom",
                                LocalDate.now(java.time.ZoneOffset.UTC).plusDays(3)));

        assertThat(created.name()).isEqualTo("Codex");
        assertThat(created.description()).isNull();
        assertThat(created.token()).isEqualTo("one-time-secret");
        assertThat(created.expiresAt())
                .isEqualTo(
                        LocalDate.now(java.time.ZoneOffset.UTC)
                                .plusDays(4)
                                .atStartOfDay(java.time.ZoneOffset.UTC)
                                .toInstant());
        verify(personalAccessTokenRepository).save(any());
        verify(authorizationService).save(any());
        verify(auditEventService)
                .record(
                        org.mockito.ArgumentMatchers.eq("account.personal-access-token.created"),
                        org.mockito.ArgumentMatchers.eq("personal_access_token"),
                        any());
    }

    @Test
    void listsTokenMetadataWithoutReturningTheSecret() {
        var entity = tokenEntity();
        when(personalAccessTokenRepository.findAllByUserUsernameOrderByCreatedAtDesc(USERNAME))
                .thenReturn(List.of(entity));

        assertThat(service.list(USERNAME))
                .containsExactly(
                        new PersonalAccessTokenDTO(
                                "token-id",
                                "Codex",
                                "Workstation",
                                PersonalAccessTokenService.SCOPE,
                                Instant.EPOCH,
                                Instant.EPOCH.plusSeconds(60)));
    }

    @Test
    void revokesTokenAndItsAuthorization() {
        var entity = tokenEntity();
        when(personalAccessTokenRepository.findByIdAndUserUsername("token-id", USERNAME))
                .thenReturn(Optional.of(entity));

        service.revoke(USERNAME, "token-id");

        verify(personalAccessTokenRepository).delete(entity);
        verify(authorizationRepository).deleteById("authorization-id");
        verify(auditEventService)
                .record(
                        "account.personal-access-token.revoked",
                        "personal_access_token",
                        "token-id");
    }

    @Test
    void cannotRevokeAnotherUsersOrUnknownToken() {
        when(personalAccessTokenRepository.findByIdAndUserUsername("token-id", USERNAME))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.revoke(USERNAME, "token-id"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Personal access token not found");

        verify(personalAccessTokenRepository, never()).delete(any());
        verify(authorizationRepository, never()).deleteById(any());
    }

    @Test
    void createsNonExpiringTokenFromJwtAndStoresClaimsMetadata() {
        Instant issuedAt = Instant.parse("2026-10-18T12:00:00Z");
        Jwt generatedToken =
                Jwt.withTokenValue("jwt-token")
                        .header("alg", "RS256")
                        .claim("sub", USERNAME)
                        .issuedAt(issuedAt)
                        .expiresAt(issuedAt.plusSeconds(300))
                        .build();
        stubTokenCreation(generatedToken);
        AuthorizationServerContext context =
                new AuthorizationServerContext() {
                    @Override
                    public String getIssuer() {
                        return "https://issuer.example";
                    }

                    @Override
                    public AuthorizationServerSettings getAuthorizationServerSettings() {
                        return AuthorizationServerSettings.builder().issuer(getIssuer()).build();
                    }
                };
        AuthorizationServerContextHolder.setContext(context);

        try {
            var created = service.create(USERNAME, request("never"));

            assertThat(created.expiresAt()).isNull();
            assertThat(created.token()).isEqualTo("jwt-token");
            var captor = org.mockito.ArgumentCaptor.forClass(OAuth2Authorization.class);
            verify(authorizationService).save(captor.capture());
            assertThat(
                            captor.getValue()
                                    .getAccessToken()
                                    .getMetadata()
                                    .get(OAuth2Authorization.Token.CLAIMS_METADATA_NAME))
                    .isEqualTo(generatedToken.getClaims());
        } finally {
            AuthorizationServerContextHolder.resetContext();
        }
    }

    @Test
    void reportsMissingUserDuringTokenPersistence() {
        stubTokenCreation(
                new OAuth2AccessToken(
                        OAuth2AccessToken.TokenType.BEARER,
                        "access-token",
                        Instant.now(),
                        Instant.now().plusSeconds(60),
                        java.util.Set.of(PersonalAccessTokenService.SCOPE)));
        when(userRepository.findByUsername(USERNAME)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(USERNAME, request("30")))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");
    }

    @Test
    void failsWhenTheAuthorizationServerCannotGenerateAToken() {
        RegisteredClient client =
                RegisteredClient.withId("pat-client")
                        .clientId(PersonalAccessTokenService.CLIENT_ID)
                        .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                        .authorizationGrantType(
                                new AuthorizationGrantType(
                                        PersonalAccessTokenService.GRANT_TYPE_VALUE))
                        .scope(PersonalAccessTokenService.SCOPE)
                        .build();
        when(personalAccessTokenRepository.countActiveByUsername(any(), any())).thenReturn(0L);
        when(registeredClientRepository.findByClientId(PersonalAccessTokenService.CLIENT_ID))
                .thenReturn(client);
        when(userDetailsService.loadUserByUsername(USERNAME))
                .thenReturn(User.withUsername(USERNAME).password("unused").roles("USER").build());
        doReturn(null).when(tokenGenerator).generate(any());

        assertThatThrownBy(() -> service.create(USERNAME, request("30")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Personal access token generation failed");
    }

    @Test
    void rejectsAnInvalidLifetimeBeforeAccessingTheClient() {
        assertThatThrownBy(() -> service.create(USERNAME, request("31")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("expiration");

        verify(registeredClientRepository, never()).findByClientId(any());
    }

    @Test
    void rejectsCustomExpirationDatesOutsideTheAllowedWindow() {
        assertThatThrownBy(() -> service.create(USERNAME, request("custom", null)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("expiration");
        assertThatThrownBy(
                        () ->
                                service.create(
                                        USERNAME, request("custom", LocalDate.now().minusDays(1))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("expiration");
        assertThatThrownBy(
                        () ->
                                service.create(
                                        USERNAME,
                                        request(
                                                "custom",
                                                LocalDate.now().plusYears(1).plusDays(1))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("expiration");
        assertThatThrownBy(
                        () -> service.create(USERNAME, request("30", LocalDate.now().plusDays(2))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("expiration");
    }

    private static PersonalAccessTokenRequestDTO request(String expiration) {
        return request(expiration, null);
    }

    private static PersonalAccessTokenRequestDTO request(
            String expiration, LocalDate customExpirationDate) {
        return new PersonalAccessTokenRequestDTO("Codex", null, expiration, customExpirationDate);
    }

    private static PersonalAccessTokenEntity tokenEntity() {
        var entity = new PersonalAccessTokenEntity();
        entity.setId("token-id");
        entity.setAuthorizationId("authorization-id");
        entity.setName("Codex");
        entity.setDescription("Workstation");
        entity.setCreatedAt(Instant.EPOCH);
        entity.setExpiresAt(Instant.EPOCH.plusSeconds(60));
        return entity;
    }

    private void stubTokenCreation(OAuth2Token generatedToken) {
        RegisteredClient client =
                RegisteredClient.withId("pat-client")
                        .clientId(PersonalAccessTokenService.CLIENT_ID)
                        .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                        .authorizationGrantType(
                                new AuthorizationGrantType(
                                        PersonalAccessTokenService.GRANT_TYPE_VALUE))
                        .scope(PersonalAccessTokenService.SCOPE)
                        .build();
        var user = User.withUsername(USERNAME).password("unused").roles("USER").build();
        var userEntity = new UserEntity();
        userEntity.setUsername(USERNAME);
        when(personalAccessTokenRepository.countActiveByUsername(any(), any())).thenReturn(0L);
        when(registeredClientRepository.findByClientId(PersonalAccessTokenService.CLIENT_ID))
                .thenReturn(client);
        when(userDetailsService.loadUserByUsername(USERNAME)).thenReturn(user);
        when(userRepository.findByUsername(USERNAME)).thenReturn(Optional.of(userEntity));
        doReturn(generatedToken).when(tokenGenerator).generate(any());
    }
}
