package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientMapperRequestDTO;
import io.github.susimsek.springauthserversamples.repository.ClientScopeMapperRepository;
import io.github.susimsek.springauthserversamples.repository.ClientScopeRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AdminClientScopeMapperServiceTest {

    private final ClientScopeMapperRepository mapperRepository =
            mock(ClientScopeMapperRepository.class);
    private final ClientScopeRepository clientScopeRepository = mock(ClientScopeRepository.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserAccessInvalidationService invalidationService =
            mock(UserAccessInvalidationService.class);

    @Test
    void createsScopeMapperAndInvalidatesUsers() {
        ClientScopeEntity scope = scope();
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(scope));
        when(mapperRepository.save(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findAll()).thenReturn(java.util.List.of());

        var result = service().create("scope-1", request());

        assertThat(result.name()).isEqualTo("email");
        assertThat(result.mapperType()).isEqualTo("user-property");
        verify(auditEventService).record("client-scope.mapper.created", "client-scope", "scope-1");
    }

    @Test
    void rejectsDuplicateScopeMapperNames() {
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(scope()));
        when(mapperRepository.existsByClientScopeIdAndNameIgnoreCase("scope-1", "email"))
                .thenReturn(true);

        assertThatThrownBy(() -> service().create("scope-1", request()))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client mapper name is already registered");
    }

    @Test
    void rejectsMapperWithoutRequiredTarget() {
        AdminClientMapperRequestDTO request =
                new AdminClientMapperRequestDTO(
                        "email", "user-property", "email", "email", false, false, null, 1);
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(scope()));

        assertThatThrownBy(() -> service().create("scope-1", request))
                .isInstanceOf(ApiException.class)
                .hasMessage("Select at least one token target");
    }

    @Test
    void protectsBuiltInScopeMappers() {
        ClientScopeEntity scope = scope();
        scope.setBuiltIn(true);
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(scope));

        assertThatThrownBy(() -> service().create("scope-1", request()))
                .isInstanceOf(ApiException.class)
                .hasMessage("Built-in client scopes cannot be changed");
    }

    private AdminClientScopeMapperService service() {
        return new AdminClientScopeMapperService(
                mapperRepository,
                clientScopeRepository,
                auditEventService,
                userRepository,
                invalidationService);
    }

    private static ClientScopeEntity scope() {
        ClientScopeEntity scope = new ClientScopeEntity();
        scope.setId("scope-1");
        scope.setName("account-api");
        return scope;
    }

    private static AdminClientMapperRequestDTO request() {
        return new AdminClientMapperRequestDTO(
                "email", "user-property", "email", "email", false, true, null, 10);
    }
}
