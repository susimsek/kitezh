package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.ClientRoleEntity;
import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.domain.ServiceAccountEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminServiceAccountRolesRequestDTO;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRoleRepository;
import io.github.susimsek.springauthserversamples.repository.ServiceAccountRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AdminServiceAccountServiceTest {

    private final ServiceAccountRepository serviceAccountRepository =
            mock(ServiceAccountRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final AuthorityRepository authorityRepository = mock(AuthorityRepository.class);
    private final ClientRepository clientRepository = mock(ClientRepository.class);
    private final ClientRoleRepository clientRoleRepository = mock(ClientRoleRepository.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final UserAccessInvalidationService invalidationService =
            mock(UserAccessInvalidationService.class);

    @Test
    void findsServiceAccountAndRejectsMissingRecords() {
        UserEntity user = user();
        ServiceAccountEntity account = new ServiceAccountEntity("client-1", user);
        when(serviceAccountRepository.findByClientId("client-1")).thenReturn(Optional.of(account));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        AdminServiceAccountService service = service();

        assertThat(service.find("client-1").username()).isEqualTo("service-account");

        when(serviceAccountRepository.findByClientId("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.find("missing"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Service account not found");

        when(serviceAccountRepository.findByClientId("client-2")).thenReturn(Optional.of(account));
        when(userRepository.findById(1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.find("client-2"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Service account user not found");
    }

    @Test
    void resolvesPublicClientRoleNamesAndFallsBackToInternalClientId() {
        UserEntity user = user();
        ClientRoleEntity role = role("client-1", "read");
        role.getClient().setClientId("public-client");
        user.setClientRoles(Set.of(role));
        ServiceAccountEntity account = new ServiceAccountEntity("client-1", user);
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-1");
        client.setClientId("public-client");
        when(serviceAccountRepository.findByClientId("client-1")).thenReturn(Optional.of(account));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(clientRepository.findById("client-1"))
                .thenReturn(Optional.of(client), Optional.empty());
        AdminServiceAccountService service = serviceWithRoleRepositories();

        assertThat(service.find("client-1").roles()).containsExactly("read");
        assertThat(service.find("client-1").roles()).isEmpty();
    }

    @Test
    void rejectsRolesFromAnotherClient() {
        UserEntity user = user();
        ServiceAccountEntity account = new ServiceAccountEntity("client-1", user);
        ClientRoleEntity role = role("client-1", "read");
        when(serviceAccountRepository.findByClientId("client-1")).thenReturn(Optional.of(account));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(clientRoleRepository.findAllById(Set.of(10L))).thenReturn(List.of(role));
        AdminServiceAccountService service = service();

        var result =
                service.replaceRoles(
                        "client-1", new AdminServiceAccountRolesRequestDTO(Set.of(10L)));

        assertThat(result.roles()).containsExactly("read");
        assertThat(result.roleIds()).containsExactly(10L);
        verify(userRepository).save(user);
        verify(invalidationService).invalidate("service-account");
        verify(auditEventService)
                .record("client.service-account.roles.updated", "client", "client-1");

        ClientRoleEntity foreignRole = role("other-client", "write");
        when(clientRoleRepository.findAllById(Set.of(11L))).thenReturn(List.of(foreignRole));
        AdminServiceAccountRolesRequestDTO request =
                new AdminServiceAccountRolesRequestDTO(Set.of(11L));
        assertThatThrownBy(() -> service.replaceRoles("client-1", request))
                .isInstanceOf(ApiException.class)
                .hasMessage("All roles must belong to this client");
    }

    @Test
    void rejectsUnknownClientRoles() {
        UserEntity user = user();
        ServiceAccountEntity account = new ServiceAccountEntity("client-1", user);
        when(serviceAccountRepository.findByClientId("client-1")).thenReturn(Optional.of(account));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(clientRoleRepository.findAllById(Set.of(99L))).thenReturn(List.of());
        var service = service();
        var request = new AdminServiceAccountRolesRequestDTO(Set.of(99L));

        assertThatThrownBy(() -> service.replaceRoles("client-1", request))
                .isInstanceOf(ApiException.class)
                .hasMessage("All client roles must exist");
    }

    @Test
    void rejectsUnknownApplicationRoles() {
        UserEntity user = user();
        ServiceAccountEntity account = new ServiceAccountEntity("client-1", user);
        when(serviceAccountRepository.findByClientId("client-1")).thenReturn(Optional.of(account));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(authorityRepository.findByNameIn(Set.of("ROLE_MISSING"))).thenReturn(List.of());
        var service = serviceWithRoleRepositories();
        var request = new AdminServiceAccountRolesRequestDTO(Set.of(), Set.of("ROLE_MISSING"));

        assertThatThrownBy(() -> service.replaceRoles("client-1", request))
                .isInstanceOf(ApiException.class)
                .hasMessage("All application roles must exist");
    }

    @Test
    void rejectsApplicationRolesWhenRepositoryIsUnavailable() {
        UserEntity user = user();
        ServiceAccountEntity account = new ServiceAccountEntity("client-1", user);
        when(serviceAccountRepository.findByClientId("client-1")).thenReturn(Optional.of(account));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        var service = service();
        var request = new AdminServiceAccountRolesRequestDTO(Set.of(), Set.of("ROLE_REPORTS"));

        assertThatThrownBy(() -> service.replaceRoles("client-1", request))
                .isInstanceOf(ApiException.class)
                .hasMessage("Application roles are unavailable");
    }

    @Test
    void acceptsNullApplicationRolesAndFallsBackWhenClientIsMissing() {
        UserEntity user = user();
        ServiceAccountEntity account = new ServiceAccountEntity("client-1", user);
        when(serviceAccountRepository.findByClientId("client-1")).thenReturn(Optional.of(account));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(clientRepository.findById("client-1")).thenReturn(Optional.empty());

        var result =
                serviceWithRoleRepositories()
                        .replaceRoles(
                                "client-1", new AdminServiceAccountRolesRequestDTO(Set.of(), null));

        assertThat(result.applicationRoles()).isEmpty();
        assertThat(result.roles()).isEmpty();
    }

    @Test
    void replacesApplicationRolesAndUsesPublicClientIdForEffectiveRoles() {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-1");
        client.setClientId("api-client");
        ClientRoleEntity role = role("client-1", "read");
        role.getClient().setClientId("api-client");
        AuthorityEntity applicationRole = new AuthorityEntity(20L, "ROLE_REPORTS");
        UserEntity user = user();
        ServiceAccountEntity account = new ServiceAccountEntity("client-1", user);
        when(serviceAccountRepository.findByClientId("client-1")).thenReturn(Optional.of(account));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(clientRepository.findById("client-1")).thenReturn(Optional.of(client));
        when(clientRoleRepository.findAllById(Set.of(10L))).thenReturn(List.of(role));
        when(authorityRepository.findByNameIn(Set.of("ROLE_REPORTS")))
                .thenReturn(List.of(applicationRole));
        var service = serviceWithRoleRepositories();

        var result =
                service.replaceRoles(
                        "client-1",
                        new AdminServiceAccountRolesRequestDTO(
                                Set.of(10L), Set.of("ROLE_REPORTS")));

        assertThat(result.applicationRoles()).containsExactly("ROLE_REPORTS");
        assertThat(result.roles()).containsExactly("read");
        assertThat(result.clientRoles()).containsEntry("api-client", Set.of("read"));
    }

    @Test
    void revokesServiceAccountTokens() {
        UserEntity user = user();
        ServiceAccountEntity account = new ServiceAccountEntity("client-1", user);
        when(serviceAccountRepository.findByClientId("client-1")).thenReturn(Optional.of(account));
        var service = service();

        service.revokeTokens("client-1");

        verify(invalidationService).invalidate("service-account");
        verify(auditEventService)
                .record("client.service-account.tokens.revoked", "client", "client-1");
    }

    @Test
    void rejectsRevocationForMissingServiceAccount() {
        when(serviceAccountRepository.findByClientId("missing")).thenReturn(Optional.empty());
        var service = service();

        assertThatThrownBy(() -> service.revokeTokens("missing"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Service account not found");
    }

    private AdminServiceAccountService service() {
        return new AdminServiceAccountService(
                serviceAccountRepository,
                userRepository,
                clientRoleRepository,
                auditEventService,
                invalidationService);
    }

    private AdminServiceAccountService serviceWithRoleRepositories() {
        return new AdminServiceAccountService(
                serviceAccountRepository,
                userRepository,
                authorityRepository,
                clientRepository,
                clientRoleRepository,
                auditEventService,
                invalidationService);
    }

    private static UserEntity user() {
        UserEntity user = new UserEntity();
        user.setId(1L);
        user.setUsername("service-account");
        return user;
    }

    private static ClientRoleEntity role(String clientId, String name) {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId(clientId);
        client.setClientId(clientId);
        ClientRoleEntity role = new ClientRoleEntity(client, name, null);
        role.setId(name.equals("read") ? 10L : 11L);
        return role;
    }
}
