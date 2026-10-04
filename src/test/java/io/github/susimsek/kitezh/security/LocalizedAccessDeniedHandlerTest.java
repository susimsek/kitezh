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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;

@ExtendWith(MockitoExtension.class)
class LocalizedAccessDeniedHandlerTest {

    @Mock private OAuth2ErrorLocalizer errorLocalizer;

    @Test
    void writesLocalizedAccessDeniedResponse() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addPreferredLocale(Locale.forLanguageTag("tr"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(errorLocalizer.localize(
                        "app.security.access_denied",
                        "You do not have permission to access this resource.",
                        Locale.forLanguageTag("tr")))
                .thenReturn("Bu kaynağa erişim izniniz yok.");

        new LocalizedAccessDeniedHandler(errorLocalizer, new OAuth2ErrorResponseWriter())
                .handle(request, response, new AccessDeniedException("boom"));

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getHeader("Content-Language")).isEqualTo("tr");
        assertThat(response.getContentAsString())
                .contains("\"error\":\"" + OAuth2ErrorCodes.ACCESS_DENIED + "\"")
                .contains("Bu kaynağa erişim izniniz yok.");
    }
}
