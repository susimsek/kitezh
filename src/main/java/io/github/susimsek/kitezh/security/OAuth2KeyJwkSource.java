package io.github.susimsek.kitezh.security;

import com.nimbusds.jose.KeySourceException;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSelector;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import io.github.susimsek.kitezh.service.OAuth2KeyService;
import java.util.List;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class OAuth2KeyJwkSource implements JWKSource<SecurityContext> {

    private final OAuth2KeyService oauth2KeyService;

    @Override
    public List<JWK> get(JWKSelector jwkSelector, SecurityContext securityContext)
            throws KeySourceException {
        return jwkSelector.select(oauth2KeyService.loadJwkSet());
    }
}
