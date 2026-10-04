package io.github.susimsek.kitezh.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.OAuth2Error;

class OAuth2ErrorResponseWriterTest {

    private final OAuth2ErrorResponseWriter writer = new OAuth2ErrorResponseWriter();

    @Test
    void writesLocalizedResponseMetadata() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        writer.write(
                response,
                HttpStatus.UNAUTHORIZED,
                new OAuth2Error("unauthorized", "Authentication is required.", null),
                Locale.forLanguageTag("tr"));

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getHeader("Content-Language")).isEqualTo("tr");
        assertThat(response.getContentAsString())
                .contains("\"error\":\"unauthorized\"")
                .contains("Authentication is required.");
    }
}
