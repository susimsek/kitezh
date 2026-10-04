package io.github.susimsek.kitezh.web;

import static jakarta.servlet.RequestDispatcher.ERROR_EXCEPTION;
import static jakarta.servlet.RequestDispatcher.ERROR_STATUS_CODE;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;

class AuthorizationErrorControllerTest {

    private final AuthorizationErrorController controller = new AuthorizationErrorController();

    @Test
    void redirectsToErrorPageUsingNestedOAuthErrorCode() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(ERROR_STATUS_CODE, 400);
        request.setAttribute(
                ERROR_EXCEPTION,
                new RuntimeException(
                        new OAuth2AuthenticationException(
                                new OAuth2Error(OAuth2ErrorCodes.INVALID_REQUEST))));
        MockHttpServletResponse response = new MockHttpServletResponse();

        String view = controller.error(request, response);

        assertThat(response.getStatus()).isEqualTo(400);
        assertThat(view).isEqualTo("redirect:/auth-error?type=invalid_request");
    }

    @Test
    void redirectsToNotFoundWhenNoOAuthErrorExistsFor404() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setAttribute(ERROR_STATUS_CODE, 404);

        String view = controller.error(request, response);

        assertThat(response.getStatus()).isEqualTo(404);
        assertThat(view).isEqualTo("redirect:/auth-error?type=not_found");
    }

    @Test
    void fallsBackToServerErrorForUnknownStatus() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        String view = controller.error(request, response);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(view).isEqualTo("redirect:/auth-error?type=" + OAuth2ErrorCodes.SERVER_ERROR);
    }
}
