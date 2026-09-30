package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.ClientMapperEntity;
import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientMapperDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientMapperRequestDTO;
import io.github.susimsek.springauthserversamples.repository.ClientMapperRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

class AdminClientMapperServiceTest {

    private final ClientMapperRepository mapperRepository = mock(ClientMapperRepository.class);
    private final ClientRepository clientRepository = mock(ClientRepository.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);

    @Test
    void canonicalizesKeycloakRoleAliasesAndAudienceClaim() {
        RegisteredClientEntity client = client();
        when(clientRepository.findById("client-1")).thenReturn(Optional.of(client));
        when(mapperRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var result =
                service()
                        .create(
                                "client-1",
                                new AdminClientMapperRequestDTO(
                                        "reports audience",
                                        "audience",
                                        null,
                                        null,
                                        false,
                                        true,
                                        "reports-api",
                                        5));

        assertThat(result.mapperType()).isEqualTo("audience");
        assertThat(result.claimName()).isEqualTo("aud");
        verify(auditEventService).record("client.mapper.created", "client", "client-1");
    }

    @Test
    void requiresClaimNameForNonAudienceMappers() {
        when(clientRepository.findById("client-1")).thenReturn(Optional.of(client()));
        AdminClientMapperService service = service();
        AdminClientMapperRequestDTO request =
                new AdminClientMapperRequestDTO(
                        "email", "email", null, null, false, true, null, 100);

        assertThatThrownBy(() -> service.create("client-1", request))
                .isInstanceOf(ApiException.class)
                .hasMessage("A claim name is required");
    }

    @Test
    void findsUpdatesAndDeletesClientMappers() {
        RegisteredClientEntity client = client();
        ClientMapperEntity mapper = mapper(client, 4L, "email");
        PageRequest pageable = PageRequest.of(0, 20);
        when(clientRepository.findById("client-1")).thenReturn(Optional.of(client));
        when(mapperRepository.findByClientIdAndNameContainingIgnoreCase("client-1", "", pageable))
                .thenReturn(new PageImpl<>(java.util.List.of(mapper), pageable, 1));
        when(mapperRepository.findById(4L)).thenReturn(Optional.of(mapper));
        when(mapperRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(service().findAll("client-1", null, pageable).getContent())
                .extracting(AdminClientMapperDTO::name)
                .containsExactly("email");
        var updated =
                service()
                        .update(
                                4L,
                                "client-1",
                                new AdminClientMapperRequestDTO(
                                        " email ", "email", null, "mail", true, true, null, 7));
        assertThat(updated.name()).isEqualTo("email");
        service().delete(4L, "client-1");
        verify(mapperRepository).delete(mapper);
        verify(auditEventService).record("client.mapper.updated", "client", "client-1");
        verify(auditEventService).record("client.mapper.deleted", "client", "client-1");
    }

    @Test
    void rejectsInvalidMapperRequests() {
        when(clientRepository.findById("client-1")).thenReturn(Optional.of(client()));
        AdminClientMapperService service = service();
        AdminClientMapperRequestDTO unsupported =
                new AdminClientMapperRequestDTO("x", "unknown", null, null, true, false, "x", 1);
        AdminClientMapperRequestDTO missingSource =
                new AdminClientMapperRequestDTO(
                        "x", "user-attribute", "", null, true, false, "x", 1);
        AdminClientMapperRequestDTO missingValue =
                new AdminClientMapperRequestDTO(
                        "x", "hardcoded-claim", null, "claim", true, false, "", 1);

        assertThatThrownBy(() -> service.create("client-1", null))
                .isInstanceOf(ApiException.class)
                .hasMessage("Request body is required");
        assertThatThrownBy(() -> service.create("client-1", unsupported))
                .isInstanceOf(ApiException.class)
                .hasMessage("Unsupported mapper type");
        assertThatThrownBy(() -> service.create("client-1", missingSource))
                .isInstanceOf(ApiException.class)
                .hasMessage("A source is required for this mapper type");
        assertThatThrownBy(() -> service.create("client-1", missingValue))
                .isInstanceOf(ApiException.class)
                .hasMessage("A value is required for this mapper type");
    }

    private AdminClientMapperService service() {
        return new AdminClientMapperService(mapperRepository, clientRepository, auditEventService);
    }

    private static RegisteredClientEntity client() {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-1");
        client.setClientId("demo-client");
        return client;
    }

    private static ClientMapperEntity mapper(RegisteredClientEntity client, Long id, String name) {
        ClientMapperEntity mapper = new ClientMapperEntity();
        mapper.setId(id);
        mapper.setClient(client);
        mapper.setName(name);
        mapper.setMapperType("email");
        mapper.setClaimName("email");
        mapper.setAddToAccessToken(true);
        return mapper;
    }
}
