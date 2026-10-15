package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationGrantAuthenticationToken;

/** UMA 2.0 grant request, with evaluated permissions attached for RPT creation. */
public final class UmaTicketAuthenticationToken
        extends OAuth2AuthorizationGrantAuthenticationToken {

    public static final String AUTHORIZATION_PERMISSIONS = "uma.authorization_permissions";
    public static final String UMA_GRANT_TYPE = AuthorizationGrantTypes.UMA_TICKET;

    private static final AuthorizationGrantType GRANT_TYPE =
            new AuthorizationGrantType(UMA_GRANT_TYPE);

    public UmaTicketAuthenticationToken(
            Authentication clientPrincipal, Map<String, Object> additionalParameters) {
        super(GRANT_TYPE, clientPrincipal, additionalParameters);
    }
}
