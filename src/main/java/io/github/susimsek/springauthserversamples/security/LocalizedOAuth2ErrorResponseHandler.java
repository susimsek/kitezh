package io.github.susimsek.springauthserversamples.security;

import io.github.susimsek.springauthserversamples.service.security.OAuth2ObservabilityMetrics;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

@Component
public class LocalizedOAuth2ErrorResponseHandler implements AuthenticationFailureHandler {

    private final OAuth2ErrorLocalizer errorLocalizer;
    private final OAuth2ErrorResponseWriter errorResponseWriter;
    private final OAuth2ObservabilityMetrics metrics;

    @Autowired
    public LocalizedOAuth2ErrorResponseHandler(
            OAuth2ErrorLocalizer errorLocalizer,
            OAuth2ErrorResponseWriter errorResponseWriter,
            OAuth2ObservabilityMetrics metrics) {
        this.errorLocalizer = errorLocalizer;
        this.errorResponseWriter = errorResponseWriter;
        this.metrics = metrics;
    }

    public LocalizedOAuth2ErrorResponseHandler(
            OAuth2ErrorLocalizer errorLocalizer, OAuth2ErrorResponseWriter errorResponseWriter) {
        this(errorLocalizer, errorResponseWriter, OAuth2ObservabilityMetrics.noop());
    }

    @Override
    public void onAuthenticationFailure(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception)
            throws IOException, ServletException {
        OAuth2Error error = resolveError(exception, request);
        metrics.recordOAuthError(request.getParameter("grant_type"), error.getErrorCode());
        if (OAuth2ErrorCodes.INVALID_CLIENT.equals(error.getErrorCode())) {
            response.addHeader(HttpHeaders.WWW_AUTHENTICATE, "Basic error=\"invalid_client\"");
        }
        errorResponseWriter.write(response, resolveStatus(error), error, request.getLocale());
    }

    private OAuth2Error resolveError(
            AuthenticationException exception, HttpServletRequest request) {
        if (exception instanceof OAuth2AuthenticationException oauth2Exception) {
            return errorLocalizer.localize(oauth2Exception.getError(), request.getLocale());
        }
        return new OAuth2Error(
                OAuth2ErrorCodes.SERVER_ERROR,
                errorLocalizer.localize(
                        "app.oauth2.error.server_error",
                        "The authorization server encountered an unexpected error.",
                        request.getLocale()),
                null);
    }

    private static HttpStatus resolveStatus(OAuth2Error error) {
        if (OAuth2ErrorCodes.INVALID_CLIENT.equals(error.getErrorCode())) {
            return HttpStatus.UNAUTHORIZED;
        }
        if (OAuth2ErrorCodes.SERVER_ERROR.equals(error.getErrorCode())) {
            return HttpStatus.INTERNAL_SERVER_ERROR;
        }
        return HttpStatus.BAD_REQUEST;
    }
}
