package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.domain.ServiceAccountEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientCreatedDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRequestDTO;
import io.github.susimsek.springauthserversamples.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.springauthserversamples.mapper.RegisteredClientMapper;
import io.github.susimsek.springauthserversamples.repository.AuthorizationConsentRepository;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.ServiceAccountRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import io.github.susimsek.springauthserversamples.security.ClientSecuritySettings;
import io.github.susimsek.springauthserversamples.security.OfflineAccessSettings;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class AdminClientServiceTest {

    @Mock private ClientRepository clientRepository;
    @Mock private AuthorizationRepository authorizationRepository;
    @Mock private AuthorizationConsentRepository authorizationConsentRepository;
    @Mock private RegisteredClientMapper registeredClientMapper;
    @Mock private AuthorizationServerMapperSupport mapperSupport;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AdminAuditEventService adminAuditEventService;
    @Mock private ServiceAccountRepository serviceAccountRepository;
    @Mock private UserRepository userRepository;

    @Test
    void createsSecretClientWithDefaultsAndAuditEvent() {
        final AtomicReference<RegisteredClient> savedClient = wireSaveMapper();
        when(clientRepository.existsByClientId("service-client")).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("encoded-secret");

        AdminClientCreatedDTO created = service().create(confidentialRequest());

        assertThat(created.client().clientId()).isEqualTo("service-client");
        assertThat(created.client().clientName()).isEqualTo("Service Client");
        assertThat(created.client().clientAuthenticationMethods())
                .containsExactly(ClientAuthenticationMethod.CLIENT_SECRET_BASIC.getValue());
        assertThat(created.client().authorizationGrantTypes())
                .containsExactly(AuthorizationGrantType.CLIENT_CREDENTIALS.getValue());
        assertThat(created.client().authorizationCodeTimeToLive()).isEqualTo(Duration.ofMinutes(5));
        assertThat(created.client().accessTokenTimeToLive()).isEqualTo(Duration.ofMinutes(5));
        assertThat(created.client().refreshTokenTimeToLive()).isEqualTo(Duration.ofHours(1));
        assertThat(created.clientSecret()).hasSize(64);
        assertThat(savedClient.get().getClientSecret()).isEqualTo("encoded-secret");
        verify(adminAuditEventService).record("client.created", "client", created.client().id());
    }

    @Test
    void rejectsDuplicateClientIdOnCreate() {
        when(clientRepository.existsByClientId("service-client")).thenReturn(true);

        assertThatThrownBy(() -> service().create(confidentialRequest()))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client ID is already registered");
    }

    @Test
    void deletingClientRemovesItsAuthorizationsAndConsents() {
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient client =
                RegisteredClient.withId("client-id")
                        .clientId("sample-client")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .scope("openid")
                        .build();
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(client);

        service().delete("client-id");

        verify(authorizationRepository).deleteByRegisteredClientId("client-id");
        verify(authorizationConsentRepository).deleteByIdRegisteredClientId("client-id");
        verify(clientRepository).deleteById("client-id");
    }

    @Test
    void deletesClientWithoutAnExistingServiceAccount() {
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient client = registeredClient("client-id", "sample-client");
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(client);
        when(serviceAccountRepository.findByClientId("client-id")).thenReturn(Optional.empty());

        serviceWithAccounts().delete("client-id");

        verify(clientRepository).deleteById("client-id");
        verify(serviceAccountRepository).findByClientId("client-id");
        verify(userRepository, never()).delete(any(UserEntity.class));
    }

    @Test
    void findAllNormalizesQueryAndMapsResults() {
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient client = registeredClient("client-id", "query-client");
        when(clientRepository.findByClientIdContainingIgnoreCaseOrClientNameContainingIgnoreCase(
                        "QUERY", "QUERY", Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(entity)));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(client);

        AdminClientDTO result =
                service().findAll("  QUERY  ", Pageable.unpaged()).getContent().getFirst();

        assertThat(result.clientId()).isEqualTo("query-client");
    }

    @Test
    void findAllIncludesServiceAccountStatusAndUsername() {
        RegisteredClientEntity entity = new RegisteredClientEntity();
        entity.setId("client-id");
        UserEntity serviceUser = new UserEntity();
        serviceUser.setUsername("service-account-query-client");
        ServiceAccountEntity account = new ServiceAccountEntity("client-id", serviceUser);
        when(clientRepository.findByClientIdContainingIgnoreCaseOrClientNameContainingIgnoreCase(
                        "", "", Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(entity)));
        when(serviceAccountRepository.findAllByClientIdIn(List.of("client-id")))
                .thenReturn(List.of(account));
        RegisteredClient client = registeredClient("client-id", "query-client");
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(client);

        AdminClientDTO result =
                serviceWithAccounts().findAll("", Pageable.unpaged()).getContent().getFirst();

        assertThat(result.serviceAccountEnabled()).isTrue();
        assertThat(result.serviceAccountUsername()).isEqualTo("service-account-query-client");
    }

    @Test
    void handlesEmptyClientPagesAndClientsWithoutServiceAccounts() {
        when(clientRepository.findByClientIdContainingIgnoreCaseOrClientNameContainingIgnoreCase(
                        "", "", Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of()));

        assertThat(serviceWithAccounts().findAll(null, Pageable.unpaged())).isEmpty();
        verifyNoInteractions(serviceAccountRepository);

        RegisteredClientEntity entity = new RegisteredClientEntity();
        entity.setId("client-id");
        RegisteredClient client = registeredClient("client-id", "query-client");
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(client);
        when(serviceAccountRepository.findByClientId("client-id")).thenReturn(Optional.empty());

        AdminClientDTO result = serviceWithAccounts().findById("client-id");

        assertThat(result.serviceAccountEnabled()).isFalse();
        assertThat(result.serviceAccountUsername()).isNull();
    }

    @Test
    void findsClientsWithMissingServiceAccountEntries() {
        RegisteredClientEntity entity = new RegisteredClientEntity();
        entity.setId("client-id");
        RegisteredClient client = registeredClient("client-id", "query-client");
        when(clientRepository.findByClientIdContainingIgnoreCaseOrClientNameContainingIgnoreCase(
                        "", "", Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(entity)));
        when(serviceAccountRepository.findAllByClientIdIn(List.of("client-id")))
                .thenReturn(List.of());
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(client);

        AdminClientDTO result =
                serviceWithAccounts().findAll(null, Pageable.unpaged()).getContent().getFirst();

        assertThat(result.serviceAccountEnabled()).isFalse();
        assertThat(result.serviceAccountUsername()).isNull();
    }

    @Test
    void findByIdReturnsNullWhenClientMissing() {
        when(clientRepository.findById("missing")).thenReturn(Optional.empty());

        assertThat(service().findById("missing")).isNull();
    }

    @Test
    void createsClientWithPostLogoutUriAndSecretPostAuthentication() {
        wireSaveMapper();
        when(clientRepository.existsByClientId("id")).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("encoded-secret");

        service().create(requestWithPostLogout("https://example.test/logout"));
        service()
                .create(
                        advancedRequest(
                                Set.of("client_secret_post"),
                                Set.of("client_credentials"),
                                "poll",
                                null,
                                null,
                                null,
                                null,
                                false));

        verify(passwordEncoder, atLeastOnce()).encode(any());
    }

    @Test
    void updateRejectsPublicAndSecretMethodCombination() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .update(
                                                "client-id",
                                                new AdminClientRequestDTO(
                                                        "service-client",
                                                        "Service Client",
                                                        Set.of("none", "client_secret_basic"),
                                                        Set.of("authorization_code"),
                                                        Set.of("https://example.test/callback"),
                                                        Set.of(),
                                                        Set.of("openid"),
                                                        false,
                                                        true,
                                                        null,
                                                        null,
                                                        null)))
                .isInstanceOf(ApiException.class)
                .hasMessage(
                        "The 'none' authentication method cannot be combined with other methods");
    }

    @Test
    void updateRejectsEnablingSecretAuthWithoutSecret() {
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient publicClient =
                RegisteredClient.withId("client-id")
                        .clientId("public-client")
                        .clientName("Public Client")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("https://example.test/callback")
                        .scope("openid")
                        .clientSettings(
                                org.springframework.security.oauth2.server.authorization.settings
                                        .ClientSettings.builder()
                                        .requireProofKey(true)
                                        .build())
                        .tokenSettings(
                                org.springframework.security.oauth2.server.authorization.settings
                                        .TokenSettings.builder()
                                        .build())
                        .build();
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(publicClient);

        assertThatThrownBy(() -> service().update("client-id", confidentialRequest()))
                .isInstanceOf(ApiException.class)
                .hasMessage(
                        "Regenerate a client secret before enabling a secret authentication"
                                + " method");
    }

    @Test
    void updateRejectsProtectedAdminConsoleClient() {
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient adminConsole = registeredClient("client-id", "admin-console");
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(adminConsole);

        assertThatThrownBy(() -> service().update("client-id", confidentialRequest()))
                .isInstanceOf(ApiException.class)
                .hasMessage("The administration console client cannot be changed");
    }

    @Test
    void regenerateSecretPersistsEncodedSecretAndAudits() {
        final AtomicReference<RegisteredClient> savedClient = wireSaveMapper();
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient client = registeredClient("client-id", "service-client");
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(client);
        when(passwordEncoder.encode(any())).thenReturn("encoded-secret");

        String rawSecret = service().regenerateSecret("client-id");

        assertThat(rawSecret).hasSize(64);
        assertThat(savedClient.get().getClientSecret()).isEqualTo("encoded-secret");
        verify(adminAuditEventService).record("client.secret.regenerated", "client", "client-id");
    }

    @Test
    void regeneratesSecretWithMissingAndConfiguredGracePeriods() {
        AtomicReference<RegisteredClient> savedClient = wireSaveMapper();
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient withoutSecret =
                RegisteredClient.from(registeredClient("client-id", "service-client"))
                        .clientSettings(
                                org.springframework.security.oauth2.server.authorization.settings
                                        .ClientSettings.withSettings(
                                                Map.of(
                                                        ClientSecuritySettings.CLIENT_ENABLED,
                                                        true,
                                                        ClientSecuritySettings.PREVIOUS_SECRET,
                                                        "old-secret",
                                                        ClientSecuritySettings
                                                                .PREVIOUS_SECRET_EXPIRES_AT,
                                                        "old-expiry"))
                                        .build())
                        .build();
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(withoutSecret);
        when(passwordEncoder.encode(any())).thenReturn("encoded-secret");

        service().regenerateSecret("client-id");

        assertThat(savedClient.get().getClientSettings().getSettings())
                .doesNotContainKeys(
                        ClientSecuritySettings.PREVIOUS_SECRET,
                        ClientSecuritySettings.PREVIOUS_SECRET_EXPIRES_AT);

        RegisteredClient withNumericGrace =
                RegisteredClient.from(registeredClient("client-id", "service-client"))
                        .clientSecret("old-encoded-secret")
                        .clientSettings(
                                org.springframework.security.oauth2.server.authorization.settings
                                        .ClientSettings.withSettings(
                                                Map.of(
                                                        ClientSecuritySettings
                                                                .SECRET_GRACE_PERIOD_SECONDS,
                                                        3600L))
                                        .build())
                        .build();
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(withNumericGrace);
        service().regenerateSecret("client-id");
        assertThat(
                        (Object)
                                savedClient
                                        .get()
                                        .getClientSettings()
                                        .getSetting(ClientSecuritySettings.PREVIOUS_SECRET))
                .isEqualTo("old-encoded-secret");

        RegisteredClient withZeroGrace =
                RegisteredClient.from(withNumericGrace)
                        .clientSettings(
                                org.springframework.security.oauth2.server.authorization.settings
                                        .ClientSettings.withSettings(
                                                Map.of(
                                                        ClientSecuritySettings
                                                                .SECRET_GRACE_PERIOD_SECONDS,
                                                        0L))
                                        .build())
                        .build();
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(withZeroGrace);
        service().regenerateSecret("client-id");

        RegisteredClient withInvalidGrace =
                RegisteredClient.from(withNumericGrace)
                        .clientSettings(
                                org.springframework.security.oauth2.server.authorization.settings
                                        .ClientSettings.withSettings(
                                                Map.of(
                                                        ClientSecuritySettings
                                                                .SECRET_GRACE_PERIOD_SECONDS,
                                                        "invalid"))
                                        .build())
                        .build();
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(withInvalidGrace);
        service().regenerateSecret("client-id");
        assertThat(
                        (Object)
                                savedClient
                                        .get()
                                        .getClientSettings()
                                        .getSetting(ClientSecuritySettings.PREVIOUS_SECRET))
                .isEqualTo("old-encoded-secret");

        RegisteredClient withStringGrace =
                RegisteredClient.from(withNumericGrace)
                        .clientSettings(
                                org.springframework.security.oauth2.server.authorization.settings
                                        .ClientSettings.withSettings(
                                                Map.of(
                                                        ClientSecuritySettings
                                                                .SECRET_GRACE_PERIOD_SECONDS,
                                                        "7200"))
                                        .build())
                        .build();
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(withStringGrace);
        service().regenerateSecret("client-id");
        assertThat(
                        (Object)
                                savedClient
                                        .get()
                                        .getClientSettings()
                                        .getSetting(ClientSecuritySettings.PREVIOUS_SECRET))
                .isEqualTo("old-encoded-secret");
    }

    @Test
    void rejectsPublicClientsWithoutPkce() {
        assertThatThrownBy(() -> service().create(publicClientRequest(false)))
                .isInstanceOf(ApiException.class)
                .hasMessage("PKCE must be required for a public authorization_code client");
    }

    @Test
    void rejectsBlankRedirectUri() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                new AdminClientRequestDTO(
                                                        "service-client",
                                                        "Service Client",
                                                        Set.of("client_secret_basic"),
                                                        Set.of("client_credentials"),
                                                        Set.of(" "),
                                                        Set.of(),
                                                        Set.of("openid"),
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        null)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Empty redirect URI is not allowed");
    }

    @Test
    void rejectsNonPositiveTtl() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                new AdminClientRequestDTO(
                                                        "service-client",
                                                        "Service Client",
                                                        Set.of("client_secret_basic"),
                                                        Set.of("client_credentials"),
                                                        Set.of(),
                                                        Set.of(),
                                                        Set.of("openid"),
                                                        false,
                                                        false,
                                                        Duration.ZERO,
                                                        null,
                                                        null)))
                .isInstanceOf(ApiException.class)
                .hasMessage("authorization code TTL must be greater than zero");
    }

    @Test
    void createsPublicClientWithoutSecret() {
        AtomicReference<RegisteredClient> savedClient = wireSaveMapper();

        AdminClientCreatedDTO created = service().create(publicClientRequest(true));

        assertThat(created.clientSecret()).isNull();
        assertThat(savedClient.get().getClientSecret()).isNull();
        assertThat(savedClient.get().getClientSettings().isRequireProofKey()).isTrue();
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void updatesClientAndPreservesExistingSecretAndSettings() {
        AtomicReference<RegisteredClient> savedClient = wireSaveMapper();
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient existing =
                RegisteredClient.withId("client-id")
                        .clientId("service-client")
                        .clientName("Old name")
                        .clientSecret("encoded-secret")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .scope("openid")
                        .clientSettings(
                                ClientScopeSettings.withAssignments(
                                        org.springframework.security.oauth2.server.authorization
                                                .settings.ClientSettings.builder()
                                                .build(),
                                        Set.of("openid"),
                                        Set.of()))
                        .tokenSettings(
                                org.springframework.security.oauth2.server.authorization.settings
                                        .TokenSettings.builder()
                                        .accessTokenTimeToLive(Duration.ofMinutes(9))
                                        .build())
                        .build();
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(existing);
        when(clientRepository.existsByClientId("renamed-client")).thenReturn(false);

        AdminClientDTO updated =
                service()
                        .update(
                                "client-id",
                                new AdminClientRequestDTO(
                                        "renamed-client",
                                        "Renamed client",
                                        Set.of("client_secret_basic"),
                                        Set.of("client_credentials"),
                                        Set.of(),
                                        Set.of(),
                                        Set.of("openid"),
                                        true,
                                        false,
                                        null,
                                        null,
                                        null));

        assertThat(updated.clientId()).isEqualTo("renamed-client");
        assertThat(savedClient.get().getClientSecret()).isEqualTo("encoded-secret");
        assertThat(savedClient.get().getTokenSettings().getAccessTokenTimeToLive())
                .isEqualTo(Duration.ofMinutes(9));
        verify(adminAuditEventService).record("client.updated", "client", "client-id");
    }

    @Test
    void rejectsRenamingClientToAnExistingClientId() {
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient existing = registeredClient("client-id", "service-client");
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(existing);
        when(clientRepository.existsByClientId("other-client")).thenReturn(true);

        assertThatThrownBy(
                        () ->
                                service()
                                        .update(
                                                "client-id",
                                                new AdminClientRequestDTO(
                                                        "other-client",
                                                        "Other client",
                                                        Set.of("client_secret_basic"),
                                                        Set.of("client_credentials"),
                                                        Set.of(),
                                                        Set.of(),
                                                        Set.of("openid"),
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        null)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client ID is already registered");
    }

    @Test
    void appliesExplicitTokenTtlsWhenUpdatingClient() {
        AtomicReference<RegisteredClient> savedClient = wireSaveMapper();
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient existing =
                RegisteredClient.from(registeredClient("client-id", "service-client"))
                        .clientSecret("encoded-secret")
                        .build();
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(existing);

        service()
                .update(
                        "client-id",
                        new AdminClientRequestDTO(
                                "service-client",
                                "Service Client",
                                Set.of("client_secret_basic"),
                                Set.of("client_credentials"),
                                Set.of(),
                                Set.of(),
                                Set.of("openid"),
                                false,
                                false,
                                Duration.ofMinutes(7),
                                Duration.ofMinutes(8),
                                Duration.ofMinutes(9)));

        assertThat(savedClient.get().getTokenSettings().getAuthorizationCodeTimeToLive())
                .isEqualTo(Duration.ofMinutes(7));
        assertThat(savedClient.get().getTokenSettings().getAccessTokenTimeToLive())
                .isEqualTo(Duration.ofMinutes(8));
        assertThat(savedClient.get().getTokenSettings().getRefreshTokenTimeToLive())
                .isEqualTo(Duration.ofMinutes(9));
    }

    @Test
    void disablesSecretAuthenticationAndClearsSecretOnUpdate() {
        final AtomicReference<RegisteredClient> savedClient = wireSaveMapper();
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient existing = registeredClient("client-id", "service-client");
        existing =
                RegisteredClient.from(existing)
                        .clientSecret("encoded-secret")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .build();
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(existing);

        service()
                .update(
                        "client-id",
                        new AdminClientRequestDTO(
                                "service-client",
                                "Service Client",
                                Set.of("none"),
                                Set.of("authorization_code"),
                                Set.of("https://example.test/callback"),
                                Set.of(),
                                Set.of("openid"),
                                false,
                                true,
                                null,
                                null,
                                null));

        assertThat(savedClient.get().getClientSecret()).isNull();
        assertThat(savedClient.get().getClientSecretExpiresAt()).isNull();
    }

    @Test
    void rejectsMissingClientAndInvalidConfigurationValues() {
        assertThatThrownBy(() -> service().create(null))
                .isInstanceOf(ApiException.class)
                .hasMessage("Request body is required");
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                request(
                                                        null,
                                                        "name",
                                                        Set.of("none"),
                                                        Set.of("authorization_code"),
                                                        Set.of("https://example.test/callback"),
                                                        Set.of("openid"),
                                                        false,
                                                        true)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client ID is required");
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                request(
                                                        "id",
                                                        " ",
                                                        Set.of("none"),
                                                        Set.of("authorization_code"),
                                                        Set.of("https://example.test/callback"),
                                                        Set.of("openid"),
                                                        false,
                                                        true)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client name is required");
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                request(
                                                        "id",
                                                        "name",
                                                        Set.of(),
                                                        Set.of("authorization_code"),
                                                        Set.of("https://example.test/callback"),
                                                        Set.of("openid"),
                                                        false,
                                                        true)))
                .isInstanceOf(ApiException.class)
                .hasMessage("At least one client authentication method is required");
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                request(
                                                        "id",
                                                        "name",
                                                        Set.of("none"),
                                                        Set.of(),
                                                        Set.of(),
                                                        Set.of("openid"),
                                                        false,
                                                        true)))
                .isInstanceOf(ApiException.class)
                .hasMessage("At least one authorization grant type is required");
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                request(
                                                        "id",
                                                        "name",
                                                        Set.of("none"),
                                                        Set.of("authorization_code"),
                                                        Set.of(),
                                                        Set.of(),
                                                        false,
                                                        true)))
                .isInstanceOf(ApiException.class)
                .hasMessage("At least one scope is required");
    }

    @Test
    void rejectsInvalidGrantUriPkceAndPostLogoutValues() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                request(
                                                        "id",
                                                        "name",
                                                        Set.of("none"),
                                                        Set.of("client_credentials"),
                                                        Set.of(),
                                                        Set.of("openid"),
                                                        false,
                                                        true)))
                .isInstanceOf(ApiException.class)
                .hasMessage("A public client cannot use the client_credentials grant");
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                request(
                                                        "id",
                                                        "name",
                                                        Set.of("client_secret_basic"),
                                                        Set.of("authorization_code"),
                                                        Set.of(),
                                                        Set.of("openid"),
                                                        false,
                                                        false)))
                .isInstanceOf(ApiException.class)
                .hasMessage("At least one redirect URI is required for authorization_code");
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                request(
                                                        "id",
                                                        "name",
                                                        Set.of("client_secret_basic"),
                                                        Set.of("client_credentials"),
                                                        Set.of(),
                                                        Set.of("openid"),
                                                        false,
                                                        true)))
                .isInstanceOf(ApiException.class)
                .hasMessage("PKCE requires the authorization_code grant");
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                request(
                                                        "id",
                                                        "name",
                                                        Set.of("client_secret_basic"),
                                                        Set.of("client_credentials"),
                                                        Set.of(
                                                                "https://example.test/callback#fragment"),
                                                        Set.of("openid"),
                                                        false,
                                                        false)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Invalid redirect URI: https://example.test/callback#fragment");
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                requestWithPostLogout(
                                                        "https://example.test/logout#fragment")))
                .isInstanceOf(ApiException.class)
                .hasMessage(
                        "Invalid post logout redirect URI: https://example.test/logout#fragment");
    }

    @Test
    void rejectsMissingClientsAndProtectedRegeneration() {
        when(clientRepository.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().update("missing", confidentialRequest()))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client not found");
        assertThatThrownBy(() -> service().delete("missing"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client not found");

        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient adminConsole = registeredClient("client-id", "admin-console");
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(adminConsole);
        assertThatThrownBy(() -> service().regenerateSecret("client-id"))
                .isInstanceOf(ApiException.class)
                .hasMessage("The administration console client cannot be changed");
    }

    @Test
    void validatesPrivateKeyJwtTlsAndServiceAccountRules() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                advancedRequest(
                                                        Set.of("private_key_jwt"),
                                                        Set.of("client_credentials"),
                                                        "poll",
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        false)))
                .isInstanceOf(ApiException.class)
                .hasMessage("A JWKS URL is required for private_key_jwt");

        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                advancedRequest(
                                                        Set.of("private_key_jwt"),
                                                        Set.of("client_credentials"),
                                                        "poll",
                                                        "https://example.test/jwks",
                                                        null,
                                                        null,
                                                        null,
                                                        false)))
                .isInstanceOf(ApiException.class)
                .hasMessage("A signing algorithm is required for private_key_jwt");

        wireSaveMapper();
        when(clientRepository.existsByClientId("advanced-client")).thenReturn(false);
        service()
                .create(
                        advancedRequest(
                                Set.of("private_key_jwt"),
                                Set.of("client_credentials"),
                                "poll",
                                "https://example.test/jwks",
                                "UNKNOWN",
                                null,
                                null,
                                false));

        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                advancedRequest(
                                                        Set.of("tls_client_auth"),
                                                        Set.of("client_credentials"),
                                                        "poll",
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        false)))
                .isInstanceOf(ApiException.class)
                .hasMessage("A certificate subject DN is required for tls_client_auth");

        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                advancedRequest(
                                                        Set.of("client_secret_basic"),
                                                        Set.of("refresh_token"),
                                                        "poll",
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        true)))
                .isInstanceOf(ApiException.class)
                .hasMessage("A service account requires the client_credentials grant");
    }

    @Test
    void createsClientWithAdvancedSecurityAndCibaSettings() {
        AtomicReference<RegisteredClient> savedClient = wireSaveMapper();
        when(clientRepository.existsByClientId("advanced-client")).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("encoded-secret");

        AdminClientCreatedDTO created =
                service()
                        .create(
                                advancedRequest(
                                        Set.of("client_secret_basic"),
                                        Set.of("client_credentials", AuthorizationGrantTypes.CIBA),
                                        " ping ",
                                        "https://example.test/jwks",
                                        "RS256",
                                        "CN=client",
                                        Duration.ofMinutes(30),
                                        false));

        RegisteredClient saved = savedClient.get();
        assertThat(created.clientSecret()).hasSize(64);
        assertThat(
                        (Object)
                                saved.getClientSettings()
                                        .getSetting(ClientSecuritySettings.CIBA_DELIVERY_MODE))
                .isEqualTo("ping");
        assertThat(
                        (Object)
                                saved.getClientSettings()
                                        .getSetting(
                                                ClientSecuritySettings.CIBA_NOTIFICATION_ENDPOINT))
                .isEqualTo("https://example.test/ciba");
        assertThat(saved.getClientSettings().isRequireProofKey()).isFalse();
        assertThat((Object) saved.getClientSettings().getSetting(ClientSecuritySettings.ROOT_URL))
                .isEqualTo("https://example.test");
        assertThat(
                        (Object)
                                saved.getClientSettings()
                                        .getSetting(ClientSecuritySettings.WEB_ORIGINS))
                .isEqualTo(Set.of("https://example.test"));
        assertThat(
                        (Object)
                                saved.getClientSettings()
                                        .getSetting(
                                                ClientSecuritySettings.SECRET_GRACE_PERIOD_SECONDS))
                .isEqualTo(1800L);
        assertThat(
                        (Object)
                                saved.getClientSettings()
                                        .getSetting(
                                                org.springframework.security.oauth2.server
                                                        .authorization.settings
                                                        .ConfigurationSettingNames.Client
                                                        .JWK_SET_URL))
                .isEqualTo("https://example.test/jwks");
        assertThat(
                        (Object)
                                saved.getClientSettings()
                                        .getSetting(
                                                org.springframework.security.oauth2.server
                                                        .authorization.settings
                                                        .ConfigurationSettingNames.Client
                                                        .TOKEN_ENDPOINT_AUTHENTICATION_SIGNING_ALGORITHM))
                .isEqualTo(org.springframework.security.oauth2.jose.jws.SignatureAlgorithm.RS256);
    }

    @Test
    void createsPrivateKeyJwtClientAndStoresOfflineSettings() {
        AtomicReference<RegisteredClient> savedClient = wireSaveMapper();
        when(clientRepository.existsByClientId("advanced-client")).thenReturn(false);

        service()
                .create(
                        advancedRequest(
                                Set.of("private_key_jwt"),
                                Set.of("client_credentials"),
                                "poll",
                                "https://example.test/jwks",
                                "RS256",
                                null,
                                null,
                                false));

        RegisteredClient saved = savedClient.get();
        assertThat(saved.getClientSecret()).isNull();
        assertThat((Object) saved.getClientSettings().getSetting("settings.client.jwk-set-url"))
                .isEqualTo("https://example.test/jwks");
    }

    @Test
    void createsTlsClientWithCertificateSubject() {
        AtomicReference<RegisteredClient> savedClient = wireSaveMapper();
        when(clientRepository.existsByClientId("advanced-client")).thenReturn(false);

        service()
                .create(
                        advancedRequest(
                                Set.of("tls_client_auth"),
                                Set.of("client_credentials"),
                                "poll",
                                null,
                                null,
                                "CN=client",
                                null,
                                false));

        assertThat(
                        (Object)
                                savedClient
                                        .get()
                                        .getClientSettings()
                                        .getSetting(
                                                org.springframework.security.oauth2.server
                                                        .authorization.settings
                                                        .ConfigurationSettingNames.Client
                                                        .X509_CERTIFICATE_SUBJECT_DN))
                .isEqualTo("CN=client");
        assertThat(savedClient.get().getClientSecret()).isNull();
    }

    @Test
    void removesOptionalClientSettingsWhenUpdateReceivesBlankValues() {
        AtomicReference<RegisteredClient> savedClient = wireSaveMapper();
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient existing =
                RegisteredClient.from(registeredClient("client-id", "service-client"))
                        .clientSecret("encoded-secret")
                        .clientSettings(
                                org.springframework.security.oauth2.server.authorization.settings
                                        .ClientSettings.withSettings(
                                                Map.of(
                                                        ClientSecuritySettings.ROOT_URL,
                                                        "https://old.example",
                                                        ClientSecuritySettings.HOME_URL,
                                                        "https://old.example/home",
                                                        ClientSecuritySettings.ADMIN_URL,
                                                        "https://old.example/admin",
                                                        ClientSecuritySettings.WEB_ORIGINS,
                                                        Set.of("https://old.example"),
                                                        ClientSecuritySettings
                                                                .SECRET_GRACE_PERIOD_SECONDS,
                                                        3600L,
                                                        org.springframework.security.oauth2.server
                                                                .authorization.settings
                                                                .ConfigurationSettingNames.Client
                                                                .JWK_SET_URL,
                                                        "https://old.example/jwks",
                                                        org.springframework.security.oauth2.server
                                                                .authorization.settings
                                                                .ConfigurationSettingNames.Client
                                                                .TOKEN_ENDPOINT_AUTHENTICATION_SIGNING_ALGORITHM,
                                                        org.springframework.security.oauth2.jose.jws
                                                                .SignatureAlgorithm.RS256,
                                                        org.springframework.security.oauth2.server
                                                                .authorization.settings
                                                                .ConfigurationSettingNames.Client
                                                                .X509_CERTIFICATE_SUBJECT_DN,
                                                        "CN=old"))
                                        .build())
                        .tokenSettings(
                                org.springframework.security.oauth2.server.authorization.settings
                                        .TokenSettings.withSettings(
                                                Map.of(
                                                        OfflineAccessSettings.OFFLINE_SESSION_IDLE,
                                                        "PT1H",
                                                        OfflineAccessSettings.OFFLINE_SESSION_MAX,
                                                        "PT2H"))
                                        .authorizationCodeTimeToLive(Duration.ofMinutes(5))
                                        .accessTokenTimeToLive(Duration.ofMinutes(5))
                                        .refreshTokenTimeToLive(Duration.ofHours(1))
                                        .build())
                        .build();
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(existing);

        service()
                .update(
                        "client-id",
                        new AdminClientRequestDTO(
                                "service-client",
                                "Service Client",
                                Set.of("client_secret_basic"),
                                Set.of("client_credentials"),
                                Set.of(),
                                Set.of(),
                                Set.of("openid"),
                                false,
                                false,
                                false,
                                false,
                                false,
                                Set.of("RS256"),
                                "poll",
                                null,
                                null,
                                Duration.ofMinutes(5),
                                Duration.ofMinutes(5),
                                Duration.ofHours(1),
                                false,
                                null,
                                false,
                                " ",
                                " ",
                                null,
                                " ",
                                null,
                                null,
                                " ",
                                null,
                                " ",
                                null));

        RegisteredClient saved = savedClient.get();
        assertThat((Object) saved.getClientSettings().getSetting(ClientSecuritySettings.ROOT_URL))
                .isNull();
        assertThat((Object) saved.getClientSettings().getSetting(ClientSecuritySettings.HOME_URL))
                .isNull();
        assertThat((Object) saved.getClientSettings().getSetting(ClientSecuritySettings.ADMIN_URL))
                .isNull();
        assertThat(
                        (Object)
                                saved.getClientSettings()
                                        .getSetting(ClientSecuritySettings.WEB_ORIGINS))
                .isEqualTo(Set.of("https://old.example"));
        assertThat(
                        (Object)
                                saved.getClientSettings()
                                        .getSetting(
                                                org.springframework.security.oauth2.server
                                                        .authorization.settings
                                                        .ConfigurationSettingNames.Client
                                                        .JWK_SET_URL))
                .isNull();
        assertThat(
                        (Object)
                                saved.getClientSettings()
                                        .getSetting(
                                                org.springframework.security.oauth2.server
                                                        .authorization.settings
                                                        .ConfigurationSettingNames.Client
                                                        .X509_CERTIFICATE_SUBJECT_DN))
                .isNull();
        assertThat(
                        (Object)
                                saved.getTokenSettings()
                                        .getSetting(OfflineAccessSettings.OFFLINE_SESSION_IDLE))
                .isNull();
        assertThat(
                        (Object)
                                saved.getTokenSettings()
                                        .getSetting(OfflineAccessSettings.OFFLINE_SESSION_MAX))
                .isNull();
    }

    @Test
    void rejectsOfflineMaximumShorterThanIdleLifetime() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                new AdminClientRequestDTO(
                                                        "offline-client",
                                                        "Offline Client",
                                                        Set.of("client_secret_basic"),
                                                        Set.of("client_credentials"),
                                                        Set.of(),
                                                        Set.of(),
                                                        Set.of("openid"),
                                                        false,
                                                        false,
                                                        false,
                                                        false,
                                                        false,
                                                        Set.of("RS256"),
                                                        "poll",
                                                        null,
                                                        null,
                                                        Duration.ofMinutes(5),
                                                        Duration.ofMinutes(5),
                                                        Duration.ofHours(1),
                                                        false,
                                                        Duration.ofDays(90),
                                                        true,
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        Duration.ofDays(10),
                                                        Duration.ofDays(1))))
                .isInstanceOf(ApiException.class)
                .hasMessage("Offline session max must be greater than or equal to idle timeout");
    }

    @Test
    void rejectsInvalidCibaConfiguration() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                advancedRequest(
                                                        Set.of("client_secret_basic"),
                                                        Set.of("client_credentials"),
                                                        "invalid",
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        false)))
                .isInstanceOf(ApiException.class)
                .hasMessage("CIBA delivery mode must be poll, ping, or push");

        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                advancedRequest(
                                                        Set.of("client_secret_basic"),
                                                        Set.of("client_credentials"),
                                                        "push",
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        false)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Ping or push delivery requires the CIBA grant");

        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                advancedRequest(
                                                        Set.of("client_secret_basic"),
                                                        Set.of(
                                                                "client_credentials",
                                                                AuthorizationGrantTypes.CIBA),
                                                        "push",
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        false,
                                                        null)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Empty CIBA notification endpoint is not allowed");
    }

    @Test
    void managesServiceAccountLifecycleAndUsername() {
        wireSaveMapper();
        when(clientRepository.existsByClientId("advanced-client")).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("encoded-secret");
        AtomicReference<UserEntity> savedUser = new AtomicReference<>();
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity user = invocation.getArgument(0);
                            savedUser.set(user);
                            return user;
                        });

        serviceWithAccounts()
                .create(
                        advancedRequest(
                                Set.of("client_secret_basic"),
                                Set.of("client_credentials"),
                                "poll",
                                null,
                                null,
                                null,
                                null,
                                true));

        verify(userRepository).save(any(UserEntity.class));
        verify(serviceAccountRepository).save(any(ServiceAccountEntity.class));
        UserEntity serviceUser = savedUser.get();
        assertThat(serviceUser.getUsername()).isEqualTo("service-account-advanced-client");
        assertThat(serviceUser.isServiceAccount()).isTrue();

        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient existing =
                RegisteredClient.from(registeredClient("client-id", "advanced-client"))
                        .clientSecret("encoded-secret")
                        .build();
        ServiceAccountEntity account = new ServiceAccountEntity("client-id", serviceUser);
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(existing);
        when(serviceAccountRepository.findByClientId("client-id")).thenReturn(Optional.of(account));

        serviceWithAccounts()
                .update(
                        "client-id",
                        advancedRequest(
                                "renamed-service-client",
                                Set.of("client_secret_basic"),
                                Set.of("client_credentials"),
                                "poll",
                                null,
                                null,
                                null,
                                null,
                                true,
                                null));

        assertThat(serviceUser.getUsername()).isEqualTo("service-account-renamed-service-client");
        verify(authorizationRepository).deleteByPrincipalName("service-account-advanced-client");
        verify(userRepository, atLeastOnce()).save(serviceUser);

        serviceWithAccounts()
                .update(
                        "client-id",
                        advancedRequest(
                                "renamed-service-client",
                                Set.of("client_secret_basic"),
                                Set.of("client_credentials"),
                                "poll",
                                null,
                                null,
                                null,
                                null,
                                false,
                                null));

        verify(serviceAccountRepository, times(1)).delete(account);
        verify(userRepository, times(1)).delete(serviceUser);
        verify(authorizationRepository)
                .deleteByPrincipalName("service-account-renamed-service-client");

        serviceWithAccounts().delete("client-id");

        verify(serviceAccountRepository, times(2)).delete(account);
        verify(userRepository, times(2)).delete(serviceUser);
    }

    @Test
    void skipsServiceAccountSynchronizationWhenUserRepositoryIsUnavailable() {
        wireSaveMapper();
        when(clientRepository.existsByClientId("advanced-client")).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("encoded-secret");

        serviceWithMissingUserRepository()
                .create(
                        advancedRequest(
                                Set.of("client_secret_basic"),
                                Set.of("client_credentials"),
                                "poll",
                                null,
                                null,
                                null,
                                null,
                                true));

        verify(serviceAccountRepository, never()).save(any(ServiceAccountEntity.class));

        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient client = registeredClient("client-id", "advanced-client");
        when(clientRepository.findById("client-id")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(client);

        serviceWithMissingUserRepository().delete("client-id");

        verify(serviceAccountRepository, never()).delete(any(ServiceAccountEntity.class));
    }

    private AdminClientService service() {
        return new AdminClientService(
                clientRepository,
                authorizationRepository,
                authorizationConsentRepository,
                registeredClientMapper,
                mapperSupport,
                passwordEncoder,
                adminAuditEventService);
    }

    private AdminClientService serviceWithAccounts() {
        return new AdminClientService(
                clientRepository,
                authorizationRepository,
                authorizationConsentRepository,
                registeredClientMapper,
                mapperSupport,
                passwordEncoder,
                adminAuditEventService,
                serviceAccountRepository,
                userRepository);
    }

    private AdminClientService serviceWithMissingUserRepository() {
        return new AdminClientService(
                clientRepository,
                authorizationRepository,
                authorizationConsentRepository,
                registeredClientMapper,
                mapperSupport,
                passwordEncoder,
                adminAuditEventService,
                serviceAccountRepository,
                null);
    }

    private AtomicReference<RegisteredClient> wireSaveMapper() {
        AtomicReference<RegisteredClient> savedClient = new AtomicReference<>();
        when(registeredClientMapper.toEntity(any(RegisteredClient.class), any()))
                .thenAnswer(
                        invocation -> {
                            savedClient.set(invocation.getArgument(0));
                            return new RegisteredClientEntity();
                        });
        when(clientRepository.save(any(RegisteredClientEntity.class)))
                .thenReturn(new RegisteredClientEntity());
        when(registeredClientMapper.toObject(any(RegisteredClientEntity.class), any()))
                .thenAnswer(invocation -> savedClient.get());
        return savedClient;
    }

    private static RegisteredClient registeredClient(String id, String clientId) {
        return RegisteredClient.withId(id)
                .clientId(clientId)
                .clientName("Service Client")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .scope("openid")
                .clientSettings(
                        org.springframework.security.oauth2.server.authorization.settings
                                .ClientSettings.builder()
                                .build())
                .tokenSettings(
                        org.springframework.security.oauth2.server.authorization.settings
                                .TokenSettings.builder()
                                .build())
                .build();
    }

    private static AdminClientRequestDTO confidentialRequest() {
        return new AdminClientRequestDTO(
                "service-client",
                "Service Client",
                Set.of("client_secret_basic"),
                Set.of("client_credentials"),
                Set.of(),
                Set.of(),
                Set.of("openid"),
                false,
                false,
                null,
                null,
                null);
    }

    private static AdminClientRequestDTO publicClientRequest(boolean requireProofKey) {
        return new AdminClientRequestDTO(
                "public-client",
                "Public client",
                Set.of("none"),
                Set.of("authorization_code"),
                Set.of("https://example.test/callback"),
                Set.of(),
                Set.of("openid"),
                false,
                requireProofKey,
                null,
                null,
                null);
    }

    private static AdminClientRequestDTO request(
            String clientId,
            String clientName,
            Set<String> methods,
            Set<String> grants,
            Set<String> redirectUris,
            Set<String> scopes,
            boolean requireConsent,
            boolean requireProofKey) {
        return new AdminClientRequestDTO(
                clientId,
                clientName,
                methods,
                grants,
                redirectUris,
                Set.of(),
                scopes,
                requireConsent,
                requireProofKey,
                null,
                null,
                null);
    }

    private static AdminClientRequestDTO requestWithPostLogout(String postLogoutUri) {
        return new AdminClientRequestDTO(
                "id",
                "name",
                Set.of("client_secret_basic"),
                Set.of("client_credentials"),
                Set.of(),
                Set.of(postLogoutUri),
                Set.of("openid"),
                false,
                false,
                null,
                null,
                null);
    }

    private static AdminClientRequestDTO advancedRequest(
            Set<String> methods,
            Set<String> grants,
            String cibaMode,
            String jwkSetUrl,
            String signingAlgorithm,
            String certificateSubjectDn,
            Duration gracePeriod,
            boolean serviceAccountEnabled) {
        return advancedRequest(
                "advanced-client",
                methods,
                grants,
                cibaMode,
                jwkSetUrl,
                signingAlgorithm,
                certificateSubjectDn,
                gracePeriod,
                serviceAccountEnabled,
                cibaMode.equalsIgnoreCase("poll") ? null : "https://example.test/ciba");
    }

    private static AdminClientRequestDTO advancedRequest(
            Set<String> methods,
            Set<String> grants,
            String cibaMode,
            String jwkSetUrl,
            String signingAlgorithm,
            String certificateSubjectDn,
            Duration gracePeriod,
            boolean serviceAccountEnabled,
            String cibaNotificationEndpoint) {
        return advancedRequest(
                "advanced-client",
                methods,
                grants,
                cibaMode,
                jwkSetUrl,
                signingAlgorithm,
                certificateSubjectDn,
                gracePeriod,
                serviceAccountEnabled,
                cibaNotificationEndpoint);
    }

    private static AdminClientRequestDTO advancedRequest(
            String clientId,
            Set<String> methods,
            Set<String> grants,
            String cibaMode,
            String jwkSetUrl,
            String signingAlgorithm,
            String certificateSubjectDn,
            Duration gracePeriod,
            boolean serviceAccountEnabled,
            String cibaNotificationEndpoint) {
        return new AdminClientRequestDTO(
                clientId,
                "Advanced client",
                methods,
                grants,
                Set.of(),
                Set.of(),
                Set.of("openid"),
                false,
                false,
                true,
                true,
                true,
                Set.of("RS256"),
                cibaMode,
                cibaNotificationEndpoint,
                null,
                Duration.ofMinutes(5),
                Duration.ofMinutes(5),
                Duration.ofHours(1),
                serviceAccountEnabled,
                Duration.ofDays(90),
                true,
                "https://example.test",
                "https://example.test/home",
                Set.of("https://example.test"),
                "https://example.test/admin",
                true,
                false,
                jwkSetUrl,
                signingAlgorithm,
                certificateSubjectDn,
                gracePeriod);
    }
}
