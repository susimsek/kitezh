package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import io.github.susimsek.springauthserversamples.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.springauthserversamples.mapper.RegisteredClientMapper;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.ClientScopeRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;

@SuppressWarnings("java:S5778")
class AdminClientScopeServiceTest {

    private final ClientScopeRepository clientScopeRepository = mock(ClientScopeRepository.class);
    private final ClientRepository clientRepository = mock(ClientRepository.class);
    private final RegisteredClientMapper registeredClientMapper =
            mock(RegisteredClientMapper.class);
    private final AuthorizationServerMapperSupport mapperSupport =
            mock(AuthorizationServerMapperSupport.class);
    private final AdminAuditEventService adminAuditEventService =
            mock(AdminAuditEventService.class);

    @Test
    void findsClientScopeById() {
        ClientScopeEntity entity = scope("scope-1", "account-api");
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(entity));

        var result = service().findOne("scope-1");

        assertThat(result.id()).isEqualTo("scope-1");
        assertThat(result.name()).isEqualTo("account-api");
    }

    @Test
    void rejectsUnknownClientScopeId() {
        when(clientScopeRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().findOne("missing"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client scope not found");
    }

    @Test
    void findsPagedAndUnpagedScopes() {
        ClientScopeEntity first = scope("scope-1", "account-api");
        ClientScopeEntity second = scope("scope-2", "admin-api");
        when(clientScopeRepository.findByNameContainingIgnoreCaseOrDisplayNameContainingIgnoreCase(
                        "api", "api", PageRequest.of(0, 10)))
                .thenReturn(new PageImpl<>(List.of(first)));
        when(clientScopeRepository.findAll(org.springframework.data.domain.Sort.by("name")))
                .thenReturn(List.of(first, second));

        assertThat(service().findAll(" api ", PageRequest.of(0, 10))).hasSize(1);
        assertThat(service().findAll())
                .extracting("name")
                .containsExactly("account-api", "admin-api");
    }

    @Test
    void createsScopeWithNormalizedOptionalValues() {
        when(clientScopeRepository.existsByName("billing")).thenReturn(false);
        ClientScopeEntity saved = scope("scope-1", "billing");
        when(clientScopeRepository.save(org.mockito.ArgumentMatchers.any())).thenReturn(saved);

        var result =
                service()
                        .create(
                                new io.github.susimsek.springauthserversamples.dto.admin
                                        .AdminClientScopeRequestDTO(
                                        " billing ",
                                        " Billing ",
                                        " Description ",
                                        null,
                                        " ",
                                        null));

        assertThat(result.name()).isEqualTo("billing");
        var entityCaptor = ArgumentCaptor.forClass(ClientScopeEntity.class);
        verify(clientScopeRepository).save(entityCaptor.capture());
        assertThat(entityCaptor.getValue().getId()).isNotBlank();
        verify(adminAuditEventService).record("client-scope.created", "client-scope", "scope-1");
    }

    @Test
    void rejectsInvalidAndDuplicateNames() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                new io.github.susimsek.springauthserversamples.dto
                                                        .admin.AdminClientScopeRequestDTO(
                                                        "bad name", null, null)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client scope name is invalid");
        when(clientScopeRepository.existsByName("billing")).thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                new io.github.susimsek.springauthserversamples.dto
                                                        .admin.AdminClientScopeRequestDTO(
                                                        "billing", null, null)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client scope already exists");
    }

    @Test
    void updatesAndRenamesAssignedScopes() {
        ClientScopeEntity entity = scope("scope-1", "old-scope");
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(entity));
        when(clientScopeRepository.findByName("new-scope")).thenReturn(Optional.empty());
        RegisteredClient client = registeredClient("old-scope");
        when(clientRepository.findAll())
                .thenReturn(
                        List.of(
                                new io.github.susimsek.springauthserversamples.domain
                                        .RegisteredClientEntity()));
        when(registeredClientMapper.toObject(
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.same(mapperSupport)))
                .thenReturn(client);
        when(registeredClientMapper.toEntity(
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.same(mapperSupport)))
                .thenReturn(
                        new io.github.susimsek.springauthserversamples.domain
                                .RegisteredClientEntity());
        when(clientScopeRepository.save(entity)).thenReturn(entity);

        var result =
                service()
                        .update(
                                "scope-1",
                                new io.github.susimsek.springauthserversamples.dto.admin
                                        .AdminClientScopeRequestDTO("new-scope", "New", null));

        assertThat(result.name()).isEqualTo("new-scope");
        verify(clientRepository).save(org.mockito.ArgumentMatchers.any());
        verify(adminAuditEventService).record("client-scope.updated", "client-scope", "scope-1");
    }

    @Test
    void updatesScopeWithoutRenamingWhenTheNameIsUnchanged() {
        ClientScopeEntity entity = scope("scope-1", "billing");
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(entity));
        when(clientScopeRepository.findByName("billing")).thenReturn(Optional.of(entity));
        when(clientScopeRepository.save(entity)).thenReturn(entity);

        assertThat(
                        service()
                                .update(
                                        "scope-1",
                                        new io.github.susimsek.springauthserversamples.dto.admin
                                                .AdminClientScopeRequestDTO("billing", null, null)))
                .isNotNull();
        verify(clientRepository, never()).findAll();
    }

    @Test
    void deletesUnassignedScopesAndRejectsAssignedOnes() {
        ClientScopeEntity entity = scope("scope-1", "billing");
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(entity));
        when(clientRepository.findAll()).thenReturn(List.of());
        service().delete("scope-1");
        verify(clientScopeRepository).delete(entity);

        when(clientRepository.findAll())
                .thenReturn(
                        List.of(
                                new io.github.susimsek.springauthserversamples.domain
                                        .RegisteredClientEntity()));
        when(mapperSupport.readCollection(org.mockito.ArgumentMatchers.any()))
                .thenReturn(Set.of("billing"));
        assertThatThrownBy(() -> service().delete("scope-1"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Assigned client scopes cannot be deleted");
    }

    @Test
    void validatesAssignmentsBeforePersisting() {
        var overlap =
                new io.github.susimsek.springauthserversamples.dto.admin
                        .AdminClientScopeAssignmentRequestDTO(Set.of("openid"), Set.of("openid"));
        assertThatThrownBy(() -> service().updateAssignments("client", overlap))
                .isInstanceOf(ApiException.class)
                .hasMessage("A scope cannot be both default and optional");
        var empty =
                new io.github.susimsek.springauthserversamples.dto.admin
                        .AdminClientScopeAssignmentRequestDTO(Set.of(), Set.of());
        assertThatThrownBy(() -> service().updateAssignments("client", empty))
                .isInstanceOf(ApiException.class)
                .hasMessage("At least one client scope is required");
        var unknown =
                new io.github.susimsek.springauthserversamples.dto.admin
                        .AdminClientScopeAssignmentRequestDTO(Set.of("openid"), Set.of());
        when(clientScopeRepository.countByNameIn(Set.of("openid"))).thenReturn(0L);
        assertThatThrownBy(() -> service().updateAssignments("client", unknown))
                .isInstanceOf(ApiException.class)
                .hasMessage("One or more client scopes do not exist");
    }

    @Test
    void updatesClientScopeAssignmentsAndRejectsUnknownClient() {
        RegisteredClient client = registeredClient("openid");
        when(clientRepository.findById("client"))
                .thenReturn(
                        Optional.of(
                                new io.github.susimsek.springauthserversamples.domain
                                        .RegisteredClientEntity()));
        when(registeredClientMapper.toObject(
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.same(mapperSupport)))
                .thenReturn(client);
        when(clientScopeRepository.countByNameIn(Set.of("openid", "profile"))).thenReturn(2L);
        when(clientScopeRepository.findAll(org.springframework.data.domain.Sort.by("name")))
                .thenReturn(List.of(scope("openid", "openid"), scope("profile", "profile")));
        when(registeredClientMapper.toEntity(
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.same(mapperSupport)))
                .thenReturn(
                        new io.github.susimsek.springauthserversamples.domain
                                .RegisteredClientEntity());

        var result =
                service()
                        .updateAssignments(
                                "client",
                                new io.github.susimsek.springauthserversamples.dto.admin
                                        .AdminClientScopeAssignmentRequestDTO(
                                        Set.of("openid"), Set.of("profile")));

        assertThat(result.defaultScopes()).containsExactly("openid");
        assertThat(result.optionalScopes()).containsExactly("profile");
        verify(clientRepository).save(org.mockito.ArgumentMatchers.any());
        verify(adminAuditEventService).record("client.scopes.updated", "client", "client");

        service().assignments("client");

        when(clientRepository.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().assignments("missing"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client not found");
    }

    private static RegisteredClient registeredClient(String scope) {
        return RegisteredClient.withId("client-1")
                .clientId("demo-client")
                .clientName("Demo")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .clientSettings(ClientSettings.builder().build())
                .scope(scope)
                .build();
    }

    private AdminClientScopeService service() {
        return new AdminClientScopeService(
                clientScopeRepository,
                clientRepository,
                registeredClientMapper,
                mapperSupport,
                adminAuditEventService);
    }

    private static ClientScopeEntity scope(String id, String name) {
        ClientScopeEntity entity = new ClientScopeEntity();
        entity.setId(id);
        entity.setName(name);
        entity.setDisplayName("Account API");
        entity.setDescription("Account access");
        Instant timestamp = Instant.parse("2026-09-05T00:00:00Z");
        entity.setCreatedAt(timestamp);
        entity.setUpdatedAt(timestamp);
        return entity;
    }
}
