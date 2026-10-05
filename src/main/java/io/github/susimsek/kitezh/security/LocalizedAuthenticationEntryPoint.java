package io.github.susimsek.kitezh.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class LocalizedAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final OAuth2ErrorLocalizer errorLocalizer;
    private final OAuth2ErrorResponseWriter errorResponseWriter;

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException authenticationException)
            throws IOException {
        OAuth2Error error =
                new OAuth2Error(
                        "unauthorized",
                        errorLocalizer.localize(
                                "app.security.unauthorized",
                                "Authentication is required.",
                                request.getLocale()),
                        null);
        errorResponseWriter.write(response, HttpStatus.UNAUTHORIZED, error, request.getLocale());
    }
}
