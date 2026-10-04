package io.github.susimsek.kitezh.config.security;

import jakarta.servlet.http.HttpServletRequest;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.web.authentication.AuthenticationConverter;

final class ConsolePublicClientAuthenticationConverter implements AuthenticationConverter {

    @Override
    public @Nullable Authentication convert(HttpServletRequest request) {
        if (!(AuthorizationGrantType.REFRESH_TOKEN
                        .getValue()
                        .equals(request.getParameter(OAuth2ParameterNames.GRANT_TYPE))
                || request.getRequestURI().endsWith("/oauth2/revoke"))) {
            return null;
        }

        String clientId = request.getParameter(OAuth2ParameterNames.CLIENT_ID);
        if (clientId == null || !ConsoleClients.ALL.contains(clientId)) {
            return null;
        }
        return new OAuth2ClientAuthenticationToken(
                clientId, ClientAuthenticationMethod.NONE, null, null);
    }
}
