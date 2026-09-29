package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientScopeRoleMappingRequestDTO;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRoleRepository;
import io.github.susimsek.springauthserversamples.repository.ClientScopeRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AdminClientScopeRoleMappingServiceTest {

    private final ClientScopeRepository scopeRepository = mock(ClientScopeRepository.class);
    private final AuthorityRepository authorityRepository = mock(AuthorityRepository.class);
    private final ClientRoleRepository clientRoleRepository = mock(ClientRoleRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserAccessInvalidationService invalidationService =
            mock(UserAccessInvalidationService.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);

    @Test
    void replacesApplicationRoleMappings() {
        ClientScopeEntity scope = scope();
        AuthorityEntity role = new AuthorityEntity(1L, "ROLE_REPORT_VIEWER");
        when(scopeRepository.findDetailedById("scope-1")).thenReturn(Optional.of(scope));
        when(authorityRepository.findByNameIn(Set.of("ROLE_REPORT_VIEWER")))
                .thenReturn(List.of(role));
        when(clientRoleRepository.findAllById(Set.of())).thenReturn(List.of());
        when(userRepository.findAll()).thenReturn(List.of());

        var result =
                service()
                        .update(
                                "scope-1",
                                new AdminClientScopeRoleMappingRequestDTO(
                                        Set.of("ROLE_REPORT_VIEWER"), Set.of()));

        assertThat(result.applicationRoles()).containsExactly("ROLE_REPORT_VIEWER");
        assertThat(scope.getApplicationRoles()).containsExactly(role);
        verify(auditEventService)
                .record("client-scope.role-mappings.updated", "client-scope", "scope-1");
    }

    @Test
    void rejectsUnknownApplicationRole() {
        when(scopeRepository.findDetailedById("scope-1")).thenReturn(Optional.of(scope()));
        when(authorityRepository.findByNameIn(Set.of("ROLE_MISSING"))).thenReturn(List.of());

        assertThatThrownBy(
                        () ->
                                service()
                                        .update(
                                                "scope-1",
                                                new AdminClientScopeRoleMappingRequestDTO(
                                                        Set.of("ROLE_MISSING"), Set.of())))
                .isInstanceOf(ApiException.class)
                .hasMessage("One or more application roles do not exist");
    }

    @Test
    void protectsBuiltInRoleMappings() {
        ClientScopeEntity scope = scope();
        scope.setBuiltIn(true);
        when(scopeRepository.findDetailedById("scope-1")).thenReturn(Optional.of(scope));

        assertThatThrownBy(
                        () ->
                                service()
                                        .update(
                                                "scope-1",
                                                new AdminClientScopeRoleMappingRequestDTO(
                                                        Set.of(), Set.of())))
                .isInstanceOf(ApiException.class)
                .hasMessage("Built-in client scopes cannot be changed");
    }

    private AdminClientScopeRoleMappingService service() {
        return new AdminClientScopeRoleMappingService(
                scopeRepository,
                authorityRepository,
                clientRoleRepository,
                userRepository,
                invalidationService,
                auditEventService);
    }

    private static ClientScopeEntity scope() {
        ClientScopeEntity scope = new ClientScopeEntity();
        scope.setId("scope-1");
        scope.setName("account-api");
        return scope;
    }
}
