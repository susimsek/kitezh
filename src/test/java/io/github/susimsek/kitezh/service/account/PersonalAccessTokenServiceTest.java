package io.github.susimsek.kitezh.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.PersonalAccessTokenRequestDTO;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.PersonalAccessTokenRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.time.LocalDate;
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
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
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
}
