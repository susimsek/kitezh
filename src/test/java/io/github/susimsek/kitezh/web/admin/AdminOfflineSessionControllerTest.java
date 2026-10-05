package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminOfflineSessionDTO;
import io.github.susimsek.kitezh.service.admin.AdminOfflineSessionService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;

class AdminOfflineSessionControllerTest {

    private final AdminOfflineSessionService service = mock(AdminOfflineSessionService.class);
    private final AdminOfflineSessionController controller =
            new AdminOfflineSessionController(service);

    @Test
    void delegatesListAndRevokeOperations() {
        final var pageable = PageRequest.of(0, 20);
        final var page = new PageImpl<AdminOfflineSessionDTO>(List.of());
        final Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("admin");
        when(service.sessions(pageable)).thenReturn(page);

        assertThat(controller.sessions(pageable)).isSameAs(page);
        assertThat(controller.revoke("auth-1", authentication).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        verify(service).sessions(pageable);
        verify(service).revoke("auth-1", "admin");
    }
}
