package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientMapperRequestDTO;
import io.github.susimsek.springauthserversamples.repository.ClientMapperRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.Optional;
import org.junit.jupiter.api.Test;

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

        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                "client-1",
                                                new AdminClientMapperRequestDTO(
                                                        "email", "email", null, null, false, true,
                                                        null, 100)))
                .isInstanceOf(ApiException.class)
                .hasMessage("A claim name is required");
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
}
