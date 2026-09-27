package io.github.susimsek.springauthserversamples.config.security;

import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.web.authentication.AuthenticationConverter;
import org.springframework.util.StringUtils;

/** Converts CIBA token requests into a Spring Authorization Server grant token. */
public final class CibaAuthenticationGrantAuthenticationConverter
        implements AuthenticationConverter {

    private static final String AUTH_REQ_ID = "auth_req_id";

    @Override
    public Authentication convert(HttpServletRequest request) {
        if (!AuthorizationGrantTypes.CIBA.equals(
                request.getParameter(OAuth2ParameterNames.GRANT_TYPE))) {
            return null;
        }
        String authReqId = request.getParameter(AUTH_REQ_ID);
        if (!StringUtils.hasText(authReqId)
                || request.getParameterValues(AUTH_REQ_ID) == null
                || request.getParameterValues(AUTH_REQ_ID).length != 1) {
            throw invalidRequest("auth_req_id is required");
        }
        Authentication clientPrincipal = SecurityContextHolder.getContext().getAuthentication();
        Map<String, Object> additionalParameters = new HashMap<>();
        request.getParameterMap()
                .forEach(
                        (key, values) -> {
                            if (!OAuth2ParameterNames.GRANT_TYPE.equals(key)
                                    && !OAuth2ParameterNames.CLIENT_ID.equals(key)
                                    && !AUTH_REQ_ID.equals(key)
                                    && values.length > 0) {
                                additionalParameters.put(key, values[0]);
                            }
                        });
        return new CibaAuthenticationGrantAuthenticationToken(
                authReqId, clientPrincipal, additionalParameters);
    }

    private static OAuth2AuthenticationException invalidRequest(String message) {
        return new OAuth2AuthenticationException(
                new OAuth2Error(OAuth2ErrorCodes.INVALID_REQUEST, message, null));
    }
}
