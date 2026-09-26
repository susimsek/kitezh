package io.github.susimsek.springauthserversamples.config.security;

import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.http.HttpServletRequest;
import java.text.ParseException;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.server.resource.web.authentication.DPoPAuthenticationConverter;
import org.springframework.security.web.authentication.AuthenticationConverter;

/** Adds nonce validation to Spring Security's DPoP resource converter. */
public final class DpopNonceAuthenticationConverter implements AuthenticationConverter {

    private final DPoPAuthenticationConverter delegate = new DPoPAuthenticationConverter();
    private final DpopNonceService nonceService;

    public DpopNonceAuthenticationConverter(DpopNonceService nonceService) {
        this.nonceService = nonceService;
    }

    @Override
    public Authentication convert(HttpServletRequest request) {
        if (this.nonceService.isRequired()) {
            String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
            String proof = request.getHeader("DPoP");
            String nonce = nonce(proof);
            if (!this.nonceService.consume(authorization, nonce)) {
                throw new OAuth2AuthenticationException(
                        new OAuth2Error(
                                OAuth2ErrorCodes.INVALID_DPOP_PROOF,
                                "DPoP nonce is missing or invalid",
                                "https://www.rfc-editor.org/rfc/rfc9449#section-8"));
            }
        }
        return this.delegate.convert(request);
    }

    private static String nonce(String proof) {
        if (proof == null || proof.isBlank()) {
            return null;
        }
        try {
            return SignedJWT.parse(proof).getJWTClaimsSet().getStringClaim("nonce");
        } catch (ParseException exception) {
            return null;
        }
    }
}
