package io.github.susimsek.kitezh.service.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.security.UmaTicketTokens;
import io.github.susimsek.kitezh.domain.AuthorizationPermissionTicketEntity;
import io.github.susimsek.kitezh.domain.AuthorizationResourceEntity;
import io.github.susimsek.kitezh.domain.AuthorizationResourceScopeEntity;
import io.github.susimsek.kitezh.dto.authz.UmaPermissionRequestDTO;
import io.github.susimsek.kitezh.dto.authz.UmaResourceRegistrationRequestDTO;
import io.github.susimsek.kitezh.repository.AuthorizationPermissionRepository;
import io.github.susimsek.kitezh.repository.AuthorizationPermissionTicketRepository;
import io.github.susimsek.kitezh.repository.AuthorizationResourceRepository;
import io.github.susimsek.kitezh.repository.AuthorizationResourceScopeRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.oauth2.jwt.Jwt;

@ExtendWith(MockitoExtension.class)
class UmaProtectionServiceTest {

    private static final String CLIENT_ID = "orders-api";
    private static final String RESOURCE_ID = "resource-1";

    @Mock private AuthorizationResourceRepository resourceRepository;
    @Mock private AuthorizationResourceScopeRepository scopeRepository;
    @Mock private AuthorizationPermissionRepository permissionRepository;
    @Mock private AuthorizationPermissionTicketRepository ticketRepository;
    @Mock private ClientRepository clientRepository;

    private UmaProtectionService service;
    private Jwt token;

    @BeforeEach
    void setUp() {
        service =
                new UmaProtectionService(
                        resourceRepository,
                        scopeRepository,
                        permissionRepository,
                        ticketRepository,
                        clientRepository);
        token =
                Jwt.withTokenValue("opaque")
                        .header("alg", "none")
                        .subject("alice")
                        .claim("client_id", CLIENT_ID)
                        .build();
        when(clientRepository.existsByClientId(CLIENT_ID)).thenReturn(true);
    }

    @Test
    void listsOwnedResourcesWithSortedScopesAndBoundsPageSize() {
        AuthorizationResourceEntity resource = resource();
        when(resourceRepository.findAllByResourceServerClientId(any(), any()))
                .thenReturn(new PageImpl<>(List.of(resource)));
        AuthorizationResourceScopeEntity view = scope("view");
        AuthorizationResourceScopeEntity edit = scope("edit");
        when(scopeRepository.findByResourceIdIn(List.of(RESOURCE_ID)))
                .thenReturn(List.of(view, edit));

        var result = service.resources(token, PageRequest.of(0, 500));

        assertThat(result.getContent().getFirst().scopes()).containsExactly("edit", "view");
        ArgumentCaptor<org.springframework.data.domain.Pageable> pageableCaptor =
                ArgumentCaptor.forClass(org.springframework.data.domain.Pageable.class);
        verify(resourceRepository).findAllByResourceServerClientId(any(), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(100);
    }

    @Test
    void listsEmptyResourcesWithoutLoadingScopes() {
        when(resourceRepository.findAllByResourceServerClientId(any(), any()))
                .thenReturn(new PageImpl<>(List.of()));

        assertThat(service.resources(token, PageRequest.of(0, 20))).isEmpty();
        verify(scopeRepository, never()).findByResourceIdIn(any());
    }

    @Test
    void rejectsUnregisteredClientAndResourcesOutsideClientOwnership() {
        when(clientRepository.existsByClientId(CLIENT_ID)).thenReturn(false);
        assertThatThrownBy(() -> service.resources(token, PageRequest.of(0, 20)))
                .isInstanceOf(ApiException.class);
        when(clientRepository.existsByClientId(CLIENT_ID)).thenReturn(true);
        when(resourceRepository.findByIdAndResourceServerClientId(RESOURCE_ID, CLIENT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resource(token, RESOURCE_ID))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void createsResourceAndReplacesScopeSet() {
        when(resourceRepository.existsByResourceServerClientIdAndNameIgnoreCase(any(), any()))
                .thenReturn(false);
        when(scopeRepository.existsByResourceIdAndName(any(), any())).thenReturn(false);
        when(scopeRepository.findByResourceId(any())).thenReturn(List.of());

        var result =
                service.createResource(
                        token,
                        new UmaResourceRegistrationRequestDTO(
                                " Orders ", " order ", " /orders ", List.of(" view ", "edit")));

        assertThat(result.name()).isEqualTo("Orders");
        assertThat(result.resourceServerClientId()).isEqualTo(CLIENT_ID);
        ArgumentCaptor<AuthorizationResourceEntity> resourceCaptor =
                ArgumentCaptor.forClass(AuthorizationResourceEntity.class);
        verify(resourceRepository).save(resourceCaptor.capture());
        assertThat(resourceCaptor.getValue().getOwnerSubject()).isEqualTo("alice");
        assertThat(resourceCaptor.getValue().getUri()).isEqualTo("/orders");
        verify(scopeRepository)
                .deleteByResourceIdAndNameNotIn(
                        any(), org.mockito.ArgumentMatchers.eq(List.of("view", "edit")));
        verify(scopeRepository, org.mockito.Mockito.times(2)).save(any());
    }

    @Test
    void rejectsDuplicateResourceAndDuplicateScopes() {
        when(resourceRepository.existsByResourceServerClientIdAndNameIgnoreCase(
                        CLIENT_ID, "Orders"))
                .thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service.createResource(
                                        token,
                                        new UmaResourceRegistrationRequestDTO(
                                                "Orders", null, null, List.of("view"))))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(
                        () ->
                                service.createResource(
                                        token,
                                        new UmaResourceRegistrationRequestDTO(
                                                "Orders", null, null, List.of("view", " view "))))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void updatesResourceAndPreventsRemovingPermissionAssignedScope() {
        AuthorizationResourceEntity resource = resource();
        when(resourceRepository.findByIdAndResourceServerClientId(RESOURCE_ID, CLIENT_ID))
                .thenReturn(Optional.of(resource));
        when(scopeRepository.findByResourceId(RESOURCE_ID)).thenReturn(List.of(scope("view")));
        when(permissionRepository.existsByResourceIdAndScopeName(RESOURCE_ID, "view"))
                .thenReturn(true);

        assertThatThrownBy(
                        () ->
                                service.updateResource(
                                        token,
                                        RESOURCE_ID,
                                        new UmaResourceRegistrationRequestDTO(
                                                "Orders", null, null, List.of("edit"))))
                .isInstanceOf(ApiException.class);
        verify(resourceRepository, never()).save(any());
    }

    @Test
    void updatesResourceWhenScopeRemovalIsSafe() {
        AuthorizationResourceEntity resource = resource();
        when(resourceRepository.findByIdAndResourceServerClientId(RESOURCE_ID, CLIENT_ID))
                .thenReturn(Optional.of(resource));
        when(scopeRepository.findByResourceId(RESOURCE_ID)).thenReturn(List.of(scope("edit")));
        when(scopeRepository.existsByResourceIdAndName(RESOURCE_ID, "edit")).thenReturn(true);

        var updated =
                service.updateResource(
                        token,
                        RESOURCE_ID,
                        new UmaResourceRegistrationRequestDTO(
                                " Updated ", " type ", " uri ", List.of("edit")));
        assertThat(updated.name()).isEqualTo("Updated");
        verify(resourceRepository).save(resource);
    }

    @Test
    void deletesOnlyOwnedResource() {
        AuthorizationResourceEntity resource = resource();
        when(resourceRepository.findByIdAndResourceServerClientId(RESOURCE_ID, CLIENT_ID))
                .thenReturn(Optional.of(resource));

        service.deleteResource(token, RESOURCE_ID);

        verify(resourceRepository).delete(resource);
    }

    @Test
    void issuesHashedShortLivedTicketForKnownScopes() {
        when(resourceRepository.findByIdAndResourceServerClientId(RESOURCE_ID, CLIENT_ID))
                .thenReturn(Optional.of(resource()));
        when(scopeRepository.existsByResourceIdAndName(RESOURCE_ID, "view")).thenReturn(true);
        when(scopeRepository.existsByResourceIdAndName(RESOURCE_ID, "edit")).thenReturn(true);

        var result =
                service.issueTicket(
                        token, new UmaPermissionRequestDTO(RESOURCE_ID, List.of("view", "edit")));

        assertThat(result.ticket()).isNotBlank();
        assertThat(result.expiresIn()).isEqualTo(60);
        ArgumentCaptor<AuthorizationPermissionTicketEntity> captor =
                ArgumentCaptor.forClass(AuthorizationPermissionTicketEntity.class);
        verify(ticketRepository).save(captor.capture());
        AuthorizationPermissionTicketEntity ticket = captor.getValue();
        assertThat(ticket.getId()).isEqualTo(UmaTicketTokens.digest(result.ticket()));
        assertThat(ticket.getId()).isNotEqualTo(result.ticket());
        assertThat(ticket.getRequestedScopes()).isEqualTo("view edit");
        assertThat(ticket.getExpiresAt()).isAfter(Instant.now());
        verify(ticketRepository).deleteByExpiresAtBefore(any());
    }

    @Test
    void rejectsEmptyDuplicateAndUnknownTicketScopes() {
        when(resourceRepository.findByIdAndResourceServerClientId(RESOURCE_ID, CLIENT_ID))
                .thenReturn(Optional.of(resource()));
        assertThatThrownBy(
                        () ->
                                service.issueTicket(
                                        token, new UmaPermissionRequestDTO(RESOURCE_ID, List.of())))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(
                        () ->
                                service.issueTicket(
                                        token,
                                        new UmaPermissionRequestDTO(
                                                RESOURCE_ID, List.of("view", " view "))))
                .isInstanceOf(ApiException.class);
        when(scopeRepository.existsByResourceIdAndName(RESOURCE_ID, "unknown")).thenReturn(false);
        assertThatThrownBy(
                        () ->
                                service.issueTicket(
                                        token,
                                        new UmaPermissionRequestDTO(
                                                RESOURCE_ID, List.of("unknown"))))
                .isInstanceOf(ApiException.class);
        verify(ticketRepository, never()).save(any());
    }

    private static AuthorizationResourceEntity resource() {
        AuthorizationResourceEntity resource = new AuthorizationResourceEntity();
        resource.setId(RESOURCE_ID);
        resource.setResourceServerClientId(CLIENT_ID);
        resource.setName("Orders");
        resource.setOwnerSubject("alice");
        return resource;
    }

    private static AuthorizationResourceScopeEntity scope(String name) {
        AuthorizationResourceScopeEntity scope = new AuthorizationResourceScopeEntity();
        scope.setResourceId(RESOURCE_ID);
        scope.setName(name);
        return scope;
    }
}
