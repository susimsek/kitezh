package io.github.susimsek.kitezh.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class LocalizedAccessDeniedHandler implements AccessDeniedHandler {

    private final OAuth2ErrorLocalizer errorLocalizer;
    private final OAuth2ErrorResponseWriter errorResponseWriter;

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException)
            throws IOException {
        OAuth2Error error =
                new OAuth2Error(
                        OAuth2ErrorCodes.ACCESS_DENIED,
                        errorLocalizer.localize(
                                "app.security.access_denied",
                                "You do not have permission to access this resource.",
                                request.getLocale()),
                        null);
        errorResponseWriter.write(response, HttpStatus.FORBIDDEN, error, request.getLocale());
    }
}
