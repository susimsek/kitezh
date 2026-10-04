package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.service.SocialLoginService;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;

class SocialAccountLinkingAuthenticationSuccessHandlerTest {

    private final SocialLoginService socialLoginService = mock(SocialLoginService.class);
    private final AuthenticationSuccessHandler delegate = mock(AuthenticationSuccessHandler.class);
    private final SocialAccountLinkingAuthenticationSuccessHandler handler =
            new SocialAccountLinkingAuthenticationSuccessHandler(socialLoginService, delegate);

    @Test
    void delegatesWhenThereIsNoExistingSession() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        Authentication authentication = mock(Authentication.class);

        handler.onAuthenticationSuccess(request, response, authentication);

        verify(delegate).onAuthenticationSuccess(request, response, authentication);
    }

    @Test
    void delegatesWhenThereIsNoPendingLink() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.getSession(true).setAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER, "google");
        MockHttpServletResponse response = new MockHttpServletResponse();
        Authentication authentication = mock(Authentication.class);

        handler.onAuthenticationSuccess(request, response, authentication);

        assertThat(request.getSession(false).getAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER))
                .isNull();
        verify(delegate).onAuthenticationSuccess(request, response, authentication);
    }

    @Test
    void completesPendingLinkAndDelegates() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.getSession(true).setAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER, "google");
        request.getSession(false)
                .setAttribute(
                        SocialLoginService.PENDING_SOCIAL_LINK,
                        Map.of("provider", "google", "subject", "subject-1"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("alice");

        handler.onAuthenticationSuccess(request, response, authentication);

        verify(socialLoginService)
                .linkPending("alice", Map.of("provider", "google", "subject", "subject-1"));
        assertThat(request.getSession(false).getAttribute(SocialLoginService.PENDING_SOCIAL_LINK))
                .isNull();
        verify(delegate).onAuthenticationSuccess(request, response, authentication);
    }

    @Test
    void redirectsToLoginWhenPendingLinkFails() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.getSession(true)
                .setAttribute(SocialLoginService.PENDING_SOCIAL_LINK, Map.of("provider", "google"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("alice");
        doThrow(new AuthenticationServiceException("link failed"))
                .when(socialLoginService)
                .linkPending(any(), any());

        handler.onAuthenticationSuccess(request, response, authentication);

        assertThat(request.getSession(false).getAttribute(SocialLoginService.PENDING_SOCIAL_LINK))
                .isNull();
        assertThat(response.getRedirectedUrl()).isEqualTo("/login?error");
    }
}
