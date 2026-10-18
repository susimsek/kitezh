package io.github.susimsek.kitezh.web.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationResourceDTO;
import io.github.susimsek.kitezh.dto.authz.UmaPermissionRequestDTO;
import io.github.susimsek.kitezh.dto.authz.UmaPermissionTicketDTO;
import io.github.susimsek.kitezh.dto.authz.UmaResourceRegistrationRequestDTO;
import io.github.susimsek.kitezh.service.authz.UmaProtectionService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;

class UmaProtectionControllerTest {

    private final UmaProtectionService service = mock(UmaProtectionService.class);
    private final UmaProtectionController controller = new UmaProtectionController(service);
    private final Jwt token =
            Jwt.withTokenValue("bearer-token")
                    .header("alg", "none")
                    .claim("sub", "resource-server")
                    .build();

    @Test
    void listsResourcesForTheResourceServer() {
        var pageable = PageRequest.of(0, 20);
        var page = new PageImpl<>(List.of(resource()));
        when(service.resources(token, pageable)).thenReturn(page);

        assertThat(controller.resources(token, pageable)).isSameAs(page);
        verify(service).resources(token, pageable);
    }

    @Test
    void getsResourceById() {
        var resource = resource();
        when(service.resource(token, "resource-id")).thenReturn(resource);

        assertThat(controller.resource(token, "resource-id")).isSameAs(resource);
        verify(service).resource(token, "resource-id");
    }

    @Test
    void createsResourceAndReturnsItsLocation() {
        var request = registrationRequest();
        var resource = resource();
        when(service.createResource(token, request)).thenReturn(resource);

        var response = controller.createResource(token, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getLocation())
                .hasToString("/api/authz/protection/resources/resource-id");
        assertThat(response.getBody()).isSameAs(resource);
        verify(service).createResource(token, request);
    }

    @Test
    void updatesResource() {
        var request = registrationRequest();
        var resource = resource();
        when(service.updateResource(token, "resource-id", request)).thenReturn(resource);

        assertThat(controller.updateResource(token, "resource-id", request)).isSameAs(resource);
        verify(service).updateResource(token, "resource-id", request);
    }

    @Test
    void deletesResource() {
        var response = controller.deleteResource(token, "resource-id");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(service).deleteResource(token, "resource-id");
    }

    @Test
    void issuesPermissionTicket() {
        var request = new UmaPermissionRequestDTO("resource-id", List.of("view"));
        var ticket = new UmaPermissionTicketDTO("permission-ticket", 60);
        when(service.issueTicket(token, request)).thenReturn(ticket);

        assertThat(controller.issueTicket(token, request)).isSameAs(ticket);
        verify(service).issueTicket(token, request);
    }

    private static UmaResourceRegistrationRequestDTO registrationRequest() {
        return new UmaResourceRegistrationRequestDTO(
                "Orders", "order", "/orders/*", List.of("view"));
    }

    private static AdminAuthorizationResourceDTO resource() {
        return new AdminAuthorizationResourceDTO(
                "resource-id",
                "orders-api",
                "Orders",
                "order",
                "/orders/*",
                "alice",
                false,
                List.of("view"));
    }
}
