package io.github.susimsek.kitezh.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.security.Principal;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class OidcSessionStatusControllerTest {

    private final OidcSessionStatusController controller = new OidcSessionStatusController();

    @Test
    void returnsAuthenticatedSessionIdWithoutCreatingAnotherSession() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        var session = request.getSession();
        Principal principal = () -> "admin";

        var response = controller.sessionStatus(request, principal);

        assertThat(response.getBody())
                .containsEntry("authenticated", true)
                .containsEntry("sessionId", session.getId());
    }

    @Test
    void reportsUnauthenticatedWhenNoSessionExists() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        var response = controller.sessionStatus(request, null);

        assertThat(response.getBody())
                .containsEntry("authenticated", false)
                .containsEntry("sessionId", "");
        assertThat(request.getSession(false)).isNull();
    }
}
