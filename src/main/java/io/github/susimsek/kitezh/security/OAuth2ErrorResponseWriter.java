package io.github.susimsek.kitezh.security;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.http.converter.OAuth2ErrorHttpMessageConverter;
import org.springframework.stereotype.Component;

@Component
public class OAuth2ErrorResponseWriter {

    private final OAuth2ErrorHttpMessageConverter errorHttpMessageConverter =
            new OAuth2ErrorHttpMessageConverter();

    public void write(
            HttpServletResponse response, HttpStatusCode status, OAuth2Error error, Locale locale)
            throws IOException {
        response.setStatus(status.value());
        response.setHeader(HttpHeaders.CONTENT_LANGUAGE, locale.toLanguageTag());
        errorHttpMessageConverter.write(error, null, new ServletServerHttpResponse(response));
    }
}
