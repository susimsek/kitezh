package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;

class DpopNonceAuthenticationConverterTest {

    @Test
    void delegatesWhenNonceIsNotRequired() {
        DpopNonceService nonceService = mock(DpopNonceService.class);
        when(nonceService.isRequired()).thenReturn(false);
        MockHttpServletRequest request = new MockHttpServletRequest();

        new DpopNonceAuthenticationConverter(nonceService).convert(request);

        verify(nonceService).isRequired();
    }

    @Test
    void rejectsMissingAndBlankProofs() {
        DpopNonceService nonceService = requiredNonceService();
        DpopNonceAuthenticationConverter converter =
                new DpopNonceAuthenticationConverter(nonceService);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer token");

        request.addHeader("DPoP", "  ");
        assertThatThrownBy(() -> converter.convert(request))
                .isInstanceOf(OAuth2AuthenticationException.class);
        request.removeHeader("DPoP");
        assertThatThrownBy(() -> converter.convert(request))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    @Test
    void rejectsMalformedProofs() {
        DpopNonceService nonceService = requiredNonceService();
        DpopNonceAuthenticationConverter converter =
                new DpopNonceAuthenticationConverter(nonceService);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer token");
        request.addHeader("DPoP", "not-a-jwt");

        assertThatThrownBy(() -> converter.convert(request))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    @Test
    void rejectsValidProofWhenNonceCannotBeConsumed() {
        DpopNonceService nonceService = requiredNonceService();
        when(nonceService.consume("Bearer token", "nonce-value")).thenReturn(false);
        DpopNonceAuthenticationConverter converter =
                new DpopNonceAuthenticationConverter(nonceService);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer token");
        request.addHeader(
                "DPoP", "eyJhbGciOiJSUzI1NiJ9.eyJub25jZSI6Im5vbmNlLXZhbHVlIn0.c2lnbmF0dXJl");

        assertThatThrownBy(() -> converter.convert(request))
                .isInstanceOf(OAuth2AuthenticationException.class);
        verify(nonceService).consume("Bearer token", "nonce-value");
    }

    private static DpopNonceService requiredNonceService() {
        DpopNonceService nonceService = mock(DpopNonceService.class);
        when(nonceService.isRequired()).thenReturn(true);
        return nonceService;
    }
}
