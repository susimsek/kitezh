package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.WebAttributes;
import org.springframework.security.web.savedrequest.RequestCache;
import org.springframework.security.web.savedrequest.SavedRequest;

class WebAuthnAuthenticationSuccessHandlerTest {

    @Test
    void returnsDefaultLocalTargetWithoutRedirectingTheFetchRequest() throws Exception {
        RequestCache requestCache = mock(RequestCache.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.getSession().setAttribute(WebAttributes.AUTHENTICATION_EXCEPTION, "failure");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new WebAuthnAuthenticationSuccessHandler(requestCache)
                .onAuthenticationSuccess(request, response, mock(Authentication.class));

        assertThat(response.getStatus()).isEqualTo(204);
        assertThat(response.getHeader(HttpHeaders.LOCATION)).isEqualTo("/admin");
        assertThat(request.getSession().getAttribute(WebAttributes.AUTHENTICATION_EXCEPTION))
                .isNull();
    }

    @Test
    void returnsTheSavedRequestAsALocalPathAndClearsIt() throws Exception {
        RequestCache requestCache = mock(RequestCache.class);
        SavedRequest savedRequest = mock(SavedRequest.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(requestCache.getRequest(request, response)).thenReturn(savedRequest);
        when(savedRequest.getRedirectUrl())
                .thenReturn("http://localhost:9090/oauth2/authorize?client_id=account-console");

        new WebAuthnAuthenticationSuccessHandler(requestCache)
                .onAuthenticationSuccess(request, response, mock(Authentication.class));

        assertThat(response.getStatus()).isEqualTo(204);
        assertThat(response.getHeader(HttpHeaders.LOCATION))
                .isEqualTo("/oauth2/authorize?client_id=account-console");
        verify(requestCache).removeRequest(request, response);
    }

    @Test
    void fallsBackToTheAdminConsoleForAnInvalidSavedTarget() throws Exception {
        RequestCache requestCache = mock(RequestCache.class);
        SavedRequest savedRequest = mock(SavedRequest.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(requestCache.getRequest(request, response)).thenReturn(savedRequest);
        when(savedRequest.getRedirectUrl()).thenReturn("not a uri");

        new WebAuthnAuthenticationSuccessHandler(requestCache)
                .onAuthenticationSuccess(request, response, mock(Authentication.class));

        assertThat(response.getHeader(HttpHeaders.LOCATION)).isEqualTo("/admin");
    }
}
