package io.github.susimsek.kitezh.web.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.security.MfaAuthorizationFilter;
import io.github.susimsek.kitezh.dto.account.RequiredActionCompleteRequestDTO;
import io.github.susimsek.kitezh.service.account.MfaService;
import io.github.susimsek.kitezh.service.requiredaction.RequiredActionService;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.Authentication;

class RequiredActionControllerTest {

    @Test
    void totpSetupKeepsCurrentSessionVerified() {
        RequiredActionService requiredActionService = mock(RequiredActionService.class);
        Authentication authentication = mock(Authentication.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        var session = request.getSession();
        when(authentication.getName()).thenReturn("alice");
        when(requiredActionService.completeInSession(
                        "alice",
                        "CONFIGURE_TOTP",
                        Map.of("code", "123456"),
                        request.getRemoteAddr(),
                        request.getHeader("User-Agent"),
                        session.getId()))
                .thenReturn(true);
        RequiredActionController controller =
                new RequiredActionController(requiredActionService, mock(MfaService.class));

        var response =
                controller.complete(
                        "CONFIGURE_TOTP",
                        new RequiredActionCompleteRequestDTO(Map.of("code", "123456")),
                        authentication,
                        request);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        assertThat(session.getAttribute(MfaAuthorizationFilter.MFA_VERIFIED)).isEqualTo(true);
        verify(requiredActionService)
                .completeInSession(
                        "alice",
                        "CONFIGURE_TOTP",
                        Map.of("code", "123456"),
                        request.getRemoteAddr(),
                        request.getHeader("User-Agent"),
                        session.getId());
    }

    @Test
    void doesNotMarkMfaVerifiedWhenTotpActionWasNotPending() {
        RequiredActionService requiredActionService = mock(RequiredActionService.class);
        Authentication authentication = mock(Authentication.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        var session = request.getSession();
        when(authentication.getName()).thenReturn("alice");
        RequiredActionController controller =
                new RequiredActionController(requiredActionService, mock(MfaService.class));

        controller.complete(
                "CONFIGURE_TOTP",
                new RequiredActionCompleteRequestDTO(Map.of("code", "invalid")),
                authentication,
                request);

        assertThat(session.getAttribute(MfaAuthorizationFilter.MFA_VERIFIED)).isNull();
    }
}
