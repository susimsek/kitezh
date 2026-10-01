package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.ClientRoleEntity;
import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.domain.ServiceAccountEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminServiceAccountRolesRequestDTO;
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
    void replacesRolesAndRejectsRolesFromAnotherClient() {
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
        assertThatThrownBy(
                        () ->
                                service.replaceRoles(
                                        "client-1",
                                        new AdminServiceAccountRolesRequestDTO(Set.of(11L))))
                .isInstanceOf(ApiException.class)
                .hasMessage("All roles must belong to this client");
    }

    private AdminServiceAccountService service() {
        return new AdminServiceAccountService(
                serviceAccountRepository,
                userRepository,
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
