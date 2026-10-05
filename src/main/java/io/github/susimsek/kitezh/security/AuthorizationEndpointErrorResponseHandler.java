package io.github.susimsek.kitezh.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationException;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationToken;
import org.springframework.security.web.DefaultRedirectStrategy;
import org.springframework.security.web.RedirectStrategy;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.util.UriUtils;

@Component
@SuppressWarnings("java:S4449")
public class AuthorizationEndpointErrorResponseHandler implements AuthenticationFailureHandler {

    private final RedirectStrategy redirectStrategy = new DefaultRedirectStrategy();

    @Override
    public void onAuthenticationFailure(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception)
            throws IOException {

        OAuth2AuthorizationCodeRequestAuthenticationException authorizationException =
                (OAuth2AuthorizationCodeRequestAuthenticationException) exception;
        OAuth2Error error = authorizationException.getError();
        OAuth2AuthorizationCodeRequestAuthenticationToken authorizationRequest =
                authorizationException.getAuthorizationCodeRequestAuthentication();

        if (authorizationRequest == null
                || !StringUtils.hasText(authorizationRequest.getRedirectUri())) {
            redirectToLocalErrorPage(request, response, error.getErrorCode());
            return;
        }

        UriComponentsBuilder uriBuilder =
                UriComponentsBuilder.fromUriString(authorizationRequest.getRedirectUri())
                        .queryParam(OAuth2ParameterNames.ERROR, error.getErrorCode());

        if (StringUtils.hasText(error.getDescription())) {
            uriBuilder.queryParam(
                    OAuth2ParameterNames.ERROR_DESCRIPTION,
                    UriUtils.encode(error.getDescription(), StandardCharsets.UTF_8));
        }
        if (StringUtils.hasText(error.getUri())) {
            uriBuilder.queryParam(
                    OAuth2ParameterNames.ERROR_URI,
                    UriUtils.encode(error.getUri(), StandardCharsets.UTF_8));
        }
        if (StringUtils.hasText(authorizationRequest.getState())) {
            uriBuilder.queryParam(
                    OAuth2ParameterNames.STATE,
                    UriUtils.encode(authorizationRequest.getState(), StandardCharsets.UTF_8));
        }

        redirectStrategy.sendRedirect(request, response, uriBuilder.build(true).toUriString());
    }

    private void redirectToLocalErrorPage(
            HttpServletRequest request, HttpServletResponse response, String errorCode)
            throws IOException {
        String errorUri =
                UriComponentsBuilder.fromPath("/")
                        .pathSegment("auth-error")
                        .queryParam("type", errorCode)
                        .build()
                        .encode()
                        .toUriString();

        redirectStrategy.sendRedirect(request, response, errorUri);
    }
}
