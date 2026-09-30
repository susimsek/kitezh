package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientCreatedDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRequestDTO;
import io.github.susimsek.springauthserversamples.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.springauthserversamples.mapper.RegisteredClientMapper;
import io.github.susimsek.springauthserversamples.repository.AuthorizationConsentRepository;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.time.Duration;
import java.util.List;
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
    void findByIdReturnsNullWhenClientMissing() {
        when(clientRepository.findById("missing")).thenReturn(Optional.empty());

        assertThat(service().findById("missing")).isNull();
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
                                                        Set.of("authorization_code"),
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
}
