package io.github.susimsek.kitezh.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.stereotype.Controller;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

@Controller
@Tag(name = "Application", description = "Application error handling endpoints.")
public class AuthorizationErrorController implements ErrorController {

    @RequestMapping(
            value = "/error",
            method = {
                RequestMethod.GET,
                RequestMethod.POST,
                RequestMethod.PUT,
                RequestMethod.PATCH,
                RequestMethod.DELETE,
                RequestMethod.HEAD,
                RequestMethod.OPTIONS,
                RequestMethod.TRACE
            })
    @Operation(
            summary = "Handle authorization errors",
            description =
                    "Redirects browser authorization errors to the localized authentication error"
                            + " page.")
    @ApiResponse(responseCode = "302", description = "Redirect to the authentication error page.")
    public String error(HttpServletRequest request, HttpServletResponse response) {
        Object statusCode = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        if (statusCode instanceof Integer status) {
            response.setStatus(status);
        }

        String errorCode = resolveOAuthErrorCode(request);
        if (!StringUtils.hasText(errorCode)) {
            errorCode = resolveFallbackErrorCode(statusCode);
        }

        return "redirect:/auth-error?type=" + URLEncoder.encode(errorCode, StandardCharsets.UTF_8);
    }

    private static String resolveOAuthErrorCode(HttpServletRequest request) {
        Throwable exception = (Throwable) request.getAttribute(RequestDispatcher.ERROR_EXCEPTION);

        while (exception != null) {
            if (exception instanceof OAuth2AuthenticationException oauth2Exception) {
                return oauth2Exception.getError().getErrorCode();
            }
            exception = exception.getCause();
        }

        return null;
    }

    private static String resolveFallbackErrorCode(Object statusCode) {
        if (statusCode instanceof Integer status && status == HttpServletResponse.SC_NOT_FOUND) {
            return "not_found";
        }
        return OAuth2ErrorCodes.SERVER_ERROR;
    }
}
