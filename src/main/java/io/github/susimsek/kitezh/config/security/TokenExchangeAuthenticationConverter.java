package io.github.susimsek.kitezh.config.security;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2TokenExchangeAuthenticationToken;
import org.springframework.security.web.authentication.AuthenticationConverter;
import org.springframework.util.StringUtils;

/** Extends RFC 8693 request parsing with refresh-token and ID-token output types. */
public final class TokenExchangeAuthenticationConverter implements AuthenticationConverter {

    public static final String ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
    public static final String JWT_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:jwt";
    public static final String REFRESH_TOKEN_TYPE =
            "urn:ietf:params:oauth:token-type:refresh_token";
    public static final String ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";

    private static final Set<String> EXTENDED_TOKEN_TYPES =
            Set.of(REFRESH_TOKEN_TYPE, ID_TOKEN_TYPE);
    private static final Set<String> SUBJECT_TOKEN_TYPES =
            Set.of(ACCESS_TOKEN_TYPE, JWT_TOKEN_TYPE);

    @Override
    public Authentication convert(HttpServletRequest request) {
        if (!AuthorizationGrantType.TOKEN_EXCHANGE
                .getValue()
                .equals(request.getParameter(OAuth2ParameterNames.GRANT_TYPE))) {
            return null;
        }
        String requestedTokenType = request.getParameter(OAuth2ParameterNames.REQUESTED_TOKEN_TYPE);
        String[] requestedTokenTypes =
                request.getParameterValues(OAuth2ParameterNames.REQUESTED_TOKEN_TYPE);
        if (!StringUtils.hasText(requestedTokenType)) {
            return null;
        }
        if (requestedTokenTypes == null || requestedTokenTypes.length != 1) {
            throw error(
                    OAuth2ErrorCodes.INVALID_REQUEST, OAuth2ParameterNames.REQUESTED_TOKEN_TYPE);
        }
        if (!EXTENDED_TOKEN_TYPES.contains(requestedTokenType)) {
            return null;
        }

        String subjectTokenType = required(request, OAuth2ParameterNames.SUBJECT_TOKEN_TYPE);
        if (!SUBJECT_TOKEN_TYPES.contains(subjectTokenType)) {
            throw error(
                    OAuth2ErrorCodes.UNSUPPORTED_TOKEN_TYPE,
                    OAuth2ParameterNames.SUBJECT_TOKEN_TYPE);
        }
        String actorToken = optional(request, OAuth2ParameterNames.ACTOR_TOKEN);
        String actorTokenType = optional(request, OAuth2ParameterNames.ACTOR_TOKEN_TYPE);
        if (StringUtils.hasText(actorToken) != StringUtils.hasText(actorTokenType)) {
            throw error(OAuth2ErrorCodes.INVALID_REQUEST, OAuth2ParameterNames.ACTOR_TOKEN);
        }
        if (StringUtils.hasText(actorTokenType) && !SUBJECT_TOKEN_TYPES.contains(actorTokenType)) {
            throw error(
                    OAuth2ErrorCodes.UNSUPPORTED_TOKEN_TYPE, OAuth2ParameterNames.ACTOR_TOKEN_TYPE);
        }

        Map<String, Object> additionalParameters = new HashMap<>();
        String dpopProof = request.getHeader(OAuth2AccessToken.TokenType.DPOP.getValue());
        if (StringUtils.hasText(dpopProof)) {
            additionalParameters.put("dpop_proof", dpopProof);
            additionalParameters.put("dpop_method", request.getMethod());
            additionalParameters.put("dpop_target_uri", request.getRequestURL().toString());
        }

        Authentication clientPrincipal = SecurityContextHolder.getContext().getAuthentication();
        if (clientPrincipal == null) {
            throw error(OAuth2ErrorCodes.INVALID_CLIENT, "client");
        }
        String subjectToken = required(request, OAuth2ParameterNames.SUBJECT_TOKEN);
        Set<String> scopes = requestedScopes(request.getParameter(OAuth2ParameterNames.SCOPE));
        return new OAuth2TokenExchangeAuthenticationToken(
                requestedTokenType,
                subjectToken,
                subjectTokenType,
                clientPrincipal,
                actorToken,
                actorTokenType,
                new LinkedHashSet<>(parameters(request, OAuth2ParameterNames.RESOURCE)),
                new LinkedHashSet<>(parameters(request, OAuth2ParameterNames.AUDIENCE)),
                scopes.isEmpty() ? null : scopes,
                additionalParameters);
    }

    private static Set<String> requestedScopes(String value) {
        return StringUtils.hasText(value)
                ? new HashSet<>(Arrays.asList(StringUtils.delimitedListToStringArray(value, " ")))
                : Set.of();
    }

    private static List<String> parameters(HttpServletRequest request, String name) {
        String[] values = request.getParameterValues(name);
        return values == null ? Collections.emptyList() : Arrays.asList(values);
    }

    private static String required(HttpServletRequest request, String name) {
        String value = optional(request, name);
        if (!StringUtils.hasText(value) || request.getParameterValues(name).length != 1) {
            throw error(OAuth2ErrorCodes.INVALID_REQUEST, name);
        }
        return value;
    }

    private static String optional(HttpServletRequest request, String name) {
        String[] values = request.getParameterValues(name);
        if (values != null && values.length > 1) {
            throw error(OAuth2ErrorCodes.INVALID_REQUEST, name);
        }
        return values == null ? null : values[0];
    }

    private static OAuth2AuthenticationException error(String code, String parameter) {
        return new OAuth2AuthenticationException(
                new OAuth2Error(code, "Invalid OAuth 2.0 parameter: " + parameter, null));
    }
}
