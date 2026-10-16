package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
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

/** Parses UMA ticket grant requests for the OAuth token endpoint. */
public final class UmaTicketAuthenticationConverter implements AuthenticationConverter {

    private static final String TICKET = "ticket";
    private static final String SUBJECT_TOKEN = "subject_token";

    @Override
    public Authentication convert(HttpServletRequest request) {
        if (!AuthorizationGrantTypes.UMA_TICKET.equals(
                request.getParameter(OAuth2ParameterNames.GRANT_TYPE))) {
            return null;
        }
        String ticket = singleRequired(request, TICKET);
        Map<String, Object> parameters = new HashMap<>();
        parameters.put(TICKET, ticket);
        String subjectToken = singleOptional(request, SUBJECT_TOKEN);
        if (StringUtils.hasText(subjectToken)) {
            parameters.put(SUBJECT_TOKEN, subjectToken);
        }
        String includeResourceName = singleOptional(request, "response_include_resource_name");
        parameters.put(
                "response_include_resource_name", !"false".equalsIgnoreCase(includeResourceName));
        Authentication clientPrincipal = SecurityContextHolder.getContext().getAuthentication();
        if (clientPrincipal == null) {
            throw error(OAuth2ErrorCodes.INVALID_CLIENT, "Client authentication is required");
        }
        return new UmaTicketAuthenticationToken(clientPrincipal, parameters);
    }

    private static String singleRequired(HttpServletRequest request, String name) {
        String value = singleOptional(request, name);
        if (!StringUtils.hasText(value)) {
            throw error(OAuth2ErrorCodes.INVALID_REQUEST, name + " is required");
        }
        return value;
    }

    private static String singleOptional(HttpServletRequest request, String name) {
        String[] values = request.getParameterValues(name);
        if (values != null && values.length != 1) {
            throw error(OAuth2ErrorCodes.INVALID_REQUEST, "Duplicate parameter: " + name);
        }
        return values == null ? null : values[0];
    }

    private static OAuth2AuthenticationException error(String code, String description) {
        return new OAuth2AuthenticationException(new OAuth2Error(code, description, null));
    }
}
