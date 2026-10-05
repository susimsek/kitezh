package io.github.susimsek.kitezh.config.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.WebAttributes;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.savedrequest.HttpSessionRequestCache;
import org.springframework.security.web.savedrequest.RequestCache;
import org.springframework.security.web.savedrequest.SavedRequest;

/** Returns a fetch-friendly passkey success response with a local navigation target. */
final class WebAuthnAuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private static final String DEFAULT_TARGET_URL = "/admin";

    private final RequestCache requestCache;

    WebAuthnAuthenticationSuccessHandler() {
        this(new HttpSessionRequestCache());
    }

    WebAuthnAuthenticationSuccessHandler(RequestCache requestCache) {
        this.requestCache = requestCache;
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException, ServletException {
        SavedRequest savedRequest = requestCache.getRequest(request, response);
        String targetUrl =
                savedRequest == null
                        ? DEFAULT_TARGET_URL
                        : localTarget(savedRequest.getRedirectUrl());
        if (savedRequest != null) {
            requestCache.removeRequest(request, response);
        }
        if (request.getSession(false) != null) {
            request.getSession(false).removeAttribute(WebAttributes.AUTHENTICATION_EXCEPTION);
        }
        response.setHeader(HttpHeaders.LOCATION, targetUrl);
        response.setStatus(HttpServletResponse.SC_NO_CONTENT);
    }

    private static String localTarget(String redirectUrl) {
        try {
            URI target = URI.create(redirectUrl);
            String path = target.getRawPath();
            if (path == null || !path.startsWith("/") || path.startsWith("//")) {
                return DEFAULT_TARGET_URL;
            }
            return target.getRawQuery() == null ? path : path + "?" + target.getRawQuery();
        } catch (IllegalArgumentException _) {
            return DEFAULT_TARGET_URL;
        }
    }
}
