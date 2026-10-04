package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminClientScopeDTO;
import io.github.susimsek.kitezh.service.admin.AdminClientScopeService;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class AdminClientScopeControllerTest {

    private final AdminClientScopeService adminClientScopeService =
            mock(AdminClientScopeService.class);
    private final AdminClientScopeController controller =
            new AdminClientScopeController(adminClientScopeService);

    @Test
    void returnsClientScopeById() {
        AdminClientScopeDTO scope = scope("scope-1");
        when(adminClientScopeService.findOne("scope-1")).thenReturn(scope);

        var result = controller.findOne("scope-1");

        assertThat(result).isSameAs(scope);
        verify(adminClientScopeService).findOne("scope-1");
    }

    private static AdminClientScopeDTO scope(String id) {
        Instant timestamp = Instant.parse("2026-09-05T00:00:00Z");
        return new AdminClientScopeDTO(
                id, "account-api", "Account API", "Account access", timestamp, timestamp);
    }
}
