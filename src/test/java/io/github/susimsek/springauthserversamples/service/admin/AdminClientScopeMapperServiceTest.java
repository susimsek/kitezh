package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import io.github.susimsek.springauthserversamples.domain.ClientScopeMapperEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientMapperDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientMapperRequestDTO;
import io.github.susimsek.springauthserversamples.repository.ClientScopeMapperRepository;
import io.github.susimsek.springauthserversamples.repository.ClientScopeRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

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
        AdminClientScopeMapperService service = service();
        AdminClientMapperRequestDTO request = request();

        assertThatThrownBy(() -> service.create("scope-1", request))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client mapper name is already registered");
    }

    @Test
    void rejectsMapperWithoutRequiredTarget() {
        AdminClientMapperRequestDTO request =
                new AdminClientMapperRequestDTO(
                        "email", "user-property", "email", "email", false, false, null, 1);
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(scope()));
        AdminClientScopeMapperService service = service();

        assertThatThrownBy(() -> service.create("scope-1", request))
                .isInstanceOf(ApiException.class)
                .hasMessage("Select at least one token target");
    }

    @Test
    void protectsBuiltInScopeMappers() {
        ClientScopeEntity scope = scope();
        scope.setBuiltIn(true);
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(scope));
        AdminClientScopeMapperService service = service();
        AdminClientMapperRequestDTO request = request();

        assertThatThrownBy(() -> service.create("scope-1", request))
                .isInstanceOf(ApiException.class)
                .hasMessage("Built-in client scopes cannot be changed");
    }

    @Test
    void findsUpdatesAndDeletesScopeMappers() {
        ClientScopeEntity scope = scope();
        ClientScopeMapperEntity mapper = mapper(scope, 4L);
        PageRequest pageable = PageRequest.of(0, 20);
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(scope));
        when(mapperRepository.findByClientScopeIdAndNameContainingIgnoreCase(
                        "scope-1", "email", pageable))
                .thenReturn(new PageImpl<>(java.util.List.of(mapper), pageable, 1));
        when(mapperRepository.findById(4L)).thenReturn(Optional.of(mapper));
        when(mapperRepository.save(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findAll()).thenReturn(java.util.List.of());

        assertThat(service().findAll("scope-1", " email ", pageable).getContent())
                .extracting(AdminClientMapperDTO::name)
                .containsExactly("email");
        assertThat(
                        service()
                                .update(
                                        "scope-1",
                                        4L,
                                        new AdminClientMapperRequestDTO(
                                                " email ", "email", null, "mail", true, true, null,
                                                7)))
                .extracting(AdminClientMapperDTO::name)
                .isEqualTo("email");
        service().delete("scope-1", 4L);
        verify(mapperRepository).delete(mapper);
        verify(auditEventService).record("client-scope.mapper.updated", "client-scope", "scope-1");
        verify(auditEventService).record("client-scope.mapper.deleted", "client-scope", "scope-1");
    }

    @Test
    void handlesBlankSearchAndDuplicateUpdates() {
        ClientScopeEntity scope = scope();
        ClientScopeMapperEntity mapper = mapper(scope, 4L);
        PageRequest pageable = PageRequest.of(0, 20);
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(scope));
        when(mapperRepository.findByClientScopeIdAndNameContainingIgnoreCase(
                        "scope-1", "", pageable))
                .thenReturn(new PageImpl<>(java.util.List.of(), pageable, 0));
        when(mapperRepository.findById(4L)).thenReturn(Optional.of(mapper));
        when(mapperRepository.existsByClientScopeIdAndNameIgnoreCaseAndIdNot(
                        "scope-1", "email", 4L))
                .thenReturn(true);

        AdminClientScopeMapperService service = service();
        assertThat(service.findAll("scope-1", null, pageable).getContent()).isEmpty();
        AdminClientMapperRequestDTO duplicateRequest =
                new AdminClientMapperRequestDTO(
                        "email", "user-property", "email", "email", true, true, null, 1);
        assertThatThrownBy(() -> service.update("scope-1", 4L, duplicateRequest))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client mapper name is already registered");
    }

    @Test
    void rejectsMapperFromAnotherScopeAndMissingScope() {
        ClientScopeEntity scope = scope();
        ClientScopeEntity otherScope = new ClientScopeEntity();
        otherScope.setId("other-scope");
        ClientScopeMapperEntity mapper = mapper(otherScope, 4L);
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(scope));
        when(mapperRepository.findById(4L)).thenReturn(Optional.of(mapper));
        AdminClientScopeMapperService service = service();

        assertThatThrownBy(() -> service.delete("scope-1", 4L))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client scope mapper not found");

        when(clientScopeRepository.findById("missing")).thenReturn(Optional.empty());
        var missingScopePage = PageRequest.of(0, 20);
        assertThatThrownBy(() -> service.findAll("missing", "", missingScopePage))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client scope not found");
    }

    @Test
    void rejectsInvalidScopeMapperRequests() {
        when(clientScopeRepository.findById("scope-1")).thenReturn(Optional.of(scope()));
        AdminClientScopeMapperService service = service();
        AdminClientMapperRequestDTO unsupported =
                new AdminClientMapperRequestDTO("x", "unknown", null, null, true, false, "x", 1);
        AdminClientMapperRequestDTO missingSource =
                new AdminClientMapperRequestDTO(
                        "x", "user-attribute", "", "claim", true, false, "x", 1);
        AdminClientMapperRequestDTO missingValue =
                new AdminClientMapperRequestDTO(
                        "x", "hardcoded-claim", null, "claim", true, false, null, 1);
        AdminClientMapperRequestDTO missingClaim =
                new AdminClientMapperRequestDTO(
                        "x", "user-property", "username", " ", true, false, null, 1);

        assertThatThrownBy(() -> service.create("scope-1", null))
                .isInstanceOf(ApiException.class)
                .hasMessage("Request body is required");
        assertThatThrownBy(() -> service.create("scope-1", unsupported))
                .isInstanceOf(ApiException.class)
                .hasMessage("Unsupported mapper type");
        assertThatThrownBy(() -> service.create("scope-1", missingSource))
                .isInstanceOf(ApiException.class)
                .hasMessage("A source is required for this mapper type");
        assertThatThrownBy(() -> service.create("scope-1", missingValue))
                .isInstanceOf(ApiException.class)
                .hasMessage("A value is required for this mapper type");
        assertThatThrownBy(() -> service.create("scope-1", missingClaim))
                .isInstanceOf(ApiException.class)
                .hasMessage("A claim name is required");
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

    private static ClientScopeMapperEntity mapper(ClientScopeEntity scope, Long id) {
        ClientScopeMapperEntity mapper = new ClientScopeMapperEntity();
        mapper.setId(id);
        mapper.setClientScope(scope);
        mapper.setName("email");
        mapper.setMapperType("email");
        mapper.setClaimName("email");
        mapper.setAddToAccessToken(true);
        return mapper;
    }
}
