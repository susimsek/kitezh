package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.RegistrationCaptchaService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class LoginCaptchaFilterTest {

    @Test
    void blocksAuthenticationWhenLoginCaptchaFails() throws Exception {
        RegistrationCaptchaService captchaService = mock(RegistrationCaptchaService.class);
        doThrow(ApiException.badRequest(ApiErrorCode.CAPTCHA_FAILED, "CAPTCHA failed"))
                .when(captchaService)
                .verifyLoginOrThrow(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        LoginCaptchaFilter filter = new LoginCaptchaFilter(captchaService);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/login");
        request.setParameter("captchaToken", "invalid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        jakarta.servlet.FilterChain chain = mock(jakarta.servlet.FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(302);
        assertThat(response.getRedirectedUrl()).isEqualTo("/login?error&captcha=failed");
        verify(captchaService).verifyLoginOrThrow("invalid-token", request);
        verifyNoInteractions(chain);
    }

    @Test
    void continuesToAuthenticationWhenLoginCaptchaSucceeds() throws Exception {
        RegistrationCaptchaService captchaService = mock(RegistrationCaptchaService.class);
        LoginCaptchaFilter filter = new LoginCaptchaFilter(captchaService);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/login");
        request.setParameter("captchaToken", "valid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        jakarta.servlet.FilterChain chain = mock(jakarta.servlet.FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(captchaService).verifyLoginOrThrow("valid-token", request);
        verify(chain).doFilter(request, response);
    }
}
