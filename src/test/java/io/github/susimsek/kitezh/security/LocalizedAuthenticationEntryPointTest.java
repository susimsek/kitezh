package io.github.susimsek.kitezh.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;

@ExtendWith(MockitoExtension.class)
class LocalizedAuthenticationEntryPointTest {

    @Mock private OAuth2ErrorLocalizer errorLocalizer;

    @Test
    void writesLocalizedUnauthorizedResponse() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addPreferredLocale(Locale.forLanguageTag("tr"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(errorLocalizer.localize(
                        "app.security.unauthorized",
                        "Authentication is required.",
                        Locale.forLanguageTag("tr")))
                .thenReturn("Kimlik doğrulaması gerekli.");

        new LocalizedAuthenticationEntryPoint(errorLocalizer, new OAuth2ErrorResponseWriter())
                .commence(request, response, new BadCredentialsException("boom"));

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getHeader("Content-Language")).isEqualTo("tr");
        assertThat(response.getContentAsString())
                .contains("\"error\":\"unauthorized\"")
                .contains("Kimlik doğrulaması gerekli.");
    }
}
