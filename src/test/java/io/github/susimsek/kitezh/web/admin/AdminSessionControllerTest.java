package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminSessionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSessionDetailDTO;
import io.github.susimsek.kitezh.service.admin.AdminSessionService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

class AdminSessionControllerTest {

    private final AdminSessionService service = mock(AdminSessionService.class);
    private final AdminSessionController controller = new AdminSessionController(service);
    private final Authentication authentication =
            UsernamePasswordAuthenticationToken.authenticated("admin", null, List.of());

    @Test
    void delegatesSessionQueries() {
        PageRequest pageable = PageRequest.of(0, 20);
        Page<AdminSessionDTO> sessions = Page.empty(pageable);
        AdminSessionDetailDTO detail = mock(AdminSessionDetailDTO.class);
        when(service.userSessions(7L, "admin", pageable)).thenReturn(sessions);
        when(service.sessions("user", "account-console", "active", pageable)).thenReturn(sessions);
        when(service.session("session-1", "admin")).thenReturn(detail);

        assertThat(controller.userSessions(7L, pageable, authentication)).isSameAs(sessions);
        assertThat(controller.sessions("user", "account-console", "active", pageable))
                .isSameAs(sessions);
        assertThat(controller.session("session-1", authentication)).isSameAs(detail);
    }

    @Test
    void delegatesSessionDeletion() {
        assertThat(controller.deleteSession("session-1", authentication).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.deleteUserSessions("alice", authentication).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        verify(service).deleteSession("session-1", "admin");
        verify(service).deleteUserSessions("alice", "admin");
    }

    @Test
    void delegatesGlobalSessionDeletion() {
        assertThat(controller.deleteAllSessions().getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        verify(service).deleteAllSessions();
    }

    @Test
    void delegatesTokenRevocation() {
        assertThat(controller.revokeAllTokens().getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.revokeUserTokens("alice", authentication).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        verify(service).revokeAllTokens();
        verify(service).revokeUserTokens("alice", "admin");
    }
}
