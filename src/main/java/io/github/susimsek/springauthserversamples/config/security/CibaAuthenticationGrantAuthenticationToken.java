package io.github.susimsek.springauthserversamples.config.security;

import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import java.util.Map;
import java.util.Objects;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationGrantAuthenticationToken;

/** Authentication token carrying a CIBA auth_req_id to the token endpoint. */
public final class CibaAuthenticationGrantAuthenticationToken
        extends OAuth2AuthorizationGrantAuthenticationToken {

    public static final String AUTH_REQ_ID_ATTRIBUTE = "ciba.auth_req_id";
    public static final String AUTH_REQ_ID_CLAIM = "urn:openid:params:jwt:claim:auth_req_id";
    public static final String ACR_VALUES_ATTRIBUTE = "ciba.acr_values";
    public static final String ACCESS_TOKEN_VALUE = "ciba.access_token";
    public static final String REFRESH_TOKEN_VALUE = "ciba.refresh_token";

    private static final AuthorizationGrantType CIBA_GRANT_TYPE =
            new AuthorizationGrantType(AuthorizationGrantTypes.CIBA);

    private final String authReqId;

    public CibaAuthenticationGrantAuthenticationToken(
            String authReqId,
            Authentication clientPrincipal,
            Map<String, Object> additionalParameters) {
        super(CIBA_GRANT_TYPE, clientPrincipal, additionalParameters);
        this.authReqId = authReqId;
    }

    public String getAuthReqId() {
        return authReqId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof CibaAuthenticationGrantAuthenticationToken token)) {
            return false;
        }
        return Objects.equals(authReqId, token.authReqId)
                && Objects.equals(getPrincipal(), token.getPrincipal())
                && Objects.equals(getAdditionalParameters(), token.getAdditionalParameters());
    }

    @Override
    public int hashCode() {
        return Objects.hash(authReqId, getPrincipal(), getAdditionalParameters());
    }
}
