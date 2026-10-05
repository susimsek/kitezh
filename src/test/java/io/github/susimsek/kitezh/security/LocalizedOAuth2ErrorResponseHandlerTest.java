package io.github.susimsek.kitezh.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;

@ExtendWith(MockitoExtension.class)
class LocalizedOAuth2ErrorResponseHandlerTest {

    @Mock private OAuth2ErrorLocalizer errorLocalizer;

    @Test
    void writesLocalizedInvalidClientResponseAndAuthenticateHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addPreferredLocale(Locale.forLanguageTag("tr"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        OAuth2Error localized =
                new OAuth2Error(OAuth2ErrorCodes.INVALID_CLIENT, "Hatali \"client\"", null);
        when(errorLocalizer.localize(
                        argThat(
                                error ->
                                        error != null
                                                && OAuth2ErrorCodes.INVALID_CLIENT.equals(
                                                        error.getErrorCode())
                                                && "bad client".equals(error.getDescription())),
                        eq(Locale.forLanguageTag("tr"))))
                .thenReturn(localized);

        new LocalizedOAuth2ErrorResponseHandler(errorLocalizer, new OAuth2ErrorResponseWriter())
                .onAuthenticationFailure(
                        request,
                        response,
                        new OAuth2AuthenticationException(
                                new OAuth2Error(
                                        OAuth2ErrorCodes.INVALID_CLIENT, "bad client", null)));

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getHeader("Content-Language")).isEqualTo("tr");
        assertThat(response.getHeader("WWW-Authenticate"))
                .isEqualTo("Basic error=\"invalid_client\"");
        assertThat(response.getContentAsString())
                .contains("\"error\":\"invalid_client\"")
                .contains("Hatali \\\"client\\\"");
    }

    @Test
    void writesLocalizedServerErrorForNonOauthException() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addPreferredLocale(Locale.ENGLISH);
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(errorLocalizer.localize(
                        "app.oauth2.error.server_error",
                        "The authorization server encountered an unexpected error.",
                        Locale.ENGLISH))
                .thenReturn("Localized server error");

        new LocalizedOAuth2ErrorResponseHandler(errorLocalizer, new OAuth2ErrorResponseWriter())
                .onAuthenticationFailure(request, response, new BadCredentialsException("boom"));

        assertThat(response.getStatus()).isEqualTo(500);
        assertThat(response.getHeader("Content-Language")).isEqualTo("en");
        assertThat(response.getHeader("WWW-Authenticate")).isNull();
        assertThat(response.getContentAsString())
                .contains("\"error\":\"server_error\"")
                .contains("Localized server error");
    }
}
