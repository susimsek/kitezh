package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminClientCreatedDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.AdminClientScopeService;
import io.github.susimsek.kitezh.service.admin.AdminClientService;
import io.github.susimsek.kitezh.service.admin.AdminConsentService;
import io.github.susimsek.kitezh.service.admin.AdminSessionService;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

class AdminClientControllerTest {

    private final AdminClientService adminClientService = mock(AdminClientService.class);
    private final AdminSessionService adminSessionService = mock(AdminSessionService.class);
    private final AdminClientScopeService adminClientScopeService =
            mock(AdminClientScopeService.class);
    private final AdminConsentService adminConsentService = mock(AdminConsentService.class);
    private final AdminAuditEventService adminAuditEventService =
            mock(AdminAuditEventService.class);
    private final AdminClientController controller =
            new AdminClientController(
                    adminClientService,
                    adminClientScopeService,
                    adminSessionService,
                    adminConsentService,
                    adminAuditEventService);

    @Test
    void returnsClientPage() {
        PageRequest pageable = PageRequest.of(0, 20);
        var page = new PageImpl<>(java.util.List.of(clientView()));
        when(adminClientService.findAll("demo", pageable)).thenReturn(page);

        var result = controller.findAll("demo", pageable);

        assertThat(result).isSameAs(page);
    }

    @Test
    void returnsClientWhenFound() {
        AdminClientDTO client = clientView();
        when(adminClientService.findById("client-1")).thenReturn(client);

        var response = controller.findById("client-1");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(client);
    }

    @Test
    void returnsNotFoundWhenClientMissing() {
        when(adminClientService.findById("missing")).thenReturn(null);

        var response = controller.findById("missing");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNull();
    }

    @Test
    void createsClientWithLocationHeader() {
        AdminClientRequestDTO request = clientRequest();
        AdminClientCreatedDTO created = new AdminClientCreatedDTO(clientView(), "secret-1");
        when(adminClientService.create(request)).thenReturn(created);

        var response = controller.create(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getLocation()).hasToString("/api/admin/clients/client-1");
        assertThat(response.getBody()).isSameAs(created);
    }

    @Test
    void updatesClient() {
        AdminClientRequestDTO request = clientRequest();
        AdminClientDTO client = clientView();
        when(adminClientService.update("client-1", request)).thenReturn(client);

        var response = controller.update("client-1", request);

        assertThat(response).isSameAs(client);
    }

    @Test
    void deletesClient() {
        var response = controller.delete("client-1");

        verify(adminClientService).delete("client-1");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void regeneratesClientSecret() {
        when(adminClientService.regenerateSecret("client-1")).thenReturn("new-secret");

        var response = controller.regenerateSecret("client-1");

        assertThat(response.clientSecret()).isEqualTo("new-secret");
    }

    @Test
    void delegatesClientSessionAndTokenActions() {
        assertThat(controller.deleteSessions("client-1").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.deleteSession("client-1", "session-1").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.revokeTokens("client-1").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        verify(adminSessionService).deleteClientSessions("client-1");
        verify(adminSessionService).deleteClientSession("client-1", "session-1");
        verify(adminSessionService).revokeClientTokens("client-1");
    }

    private static AdminClientRequestDTO clientRequest() {
        return new AdminClientRequestDTO(
                "demo-client",
                "Demo Client",
                Set.of("client_secret_basic"),
                Set.of("client_credentials"),
                Set.of(),
                Set.of(),
                Set.of("openid"),
                false,
                false,
                Duration.ofMinutes(5),
                Duration.ofMinutes(5),
                Duration.ofHours(1));
    }

    private static AdminClientDTO clientView() {
        return new AdminClientDTO(
                "client-1",
                "demo-client",
                "Demo Client",
                Instant.parse("2026-08-21T00:00:00Z"),
                null,
                Set.of("client_secret_basic"),
                Set.of("client_credentials"),
                Set.of(),
                Set.of(),
                Set.of("openid"),
                false,
                false,
                Duration.ofMinutes(5),
                Duration.ofMinutes(5),
                Duration.ofHours(1));
    }
}
