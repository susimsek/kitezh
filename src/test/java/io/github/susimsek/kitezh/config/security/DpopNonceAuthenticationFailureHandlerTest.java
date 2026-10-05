package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;

class DpopNonceAuthenticationFailureHandlerTest {

    @Test
    void issuesNonceWhenPolicyRequiresIt() throws Exception {
        DpopNonceService nonceService = mock(DpopNonceService.class);
        when(nonceService.isRequired()).thenReturn(true);
        when(nonceService.issue("DPoP proof")).thenReturn("nonce-value");
        DpopNonceAuthenticationFailureHandler handler =
                new DpopNonceAuthenticationFailureHandler(nonceService);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "DPoP proof");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationFailure(
                request, response, new BadCredentialsException("invalid proof"));

        assertThat(response.getHeader("DPoP-Nonce")).isEqualTo("nonce-value");
        verify(nonceService).issue("DPoP proof");
        assertThat(response.getStatus()).isEqualTo(401);
    }

    @Test
    void skipsNonceWhenPolicyIsDisabled() throws Exception {
        DpopNonceService nonceService = mock(DpopNonceService.class);
        when(nonceService.isRequired()).thenReturn(false);
        DpopNonceAuthenticationFailureHandler handler =
                new DpopNonceAuthenticationFailureHandler(nonceService);
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationFailure(
                new MockHttpServletRequest(),
                response,
                new BadCredentialsException("invalid proof"));

        assertThat(response.getHeader("DPoP-Nonce")).isNull();
        assertThat(response.getStatus()).isEqualTo(401);
    }
}
