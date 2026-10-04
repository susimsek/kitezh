package io.github.susimsek.kitezh.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKMatcher;
import com.nimbusds.jose.jwk.JWKSelector;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import io.github.susimsek.kitezh.service.OAuth2KeyService;
import java.security.KeyPair;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.List;
import org.junit.jupiter.api.Test;

class OAuth2KeyJwkSourceTest {

    @Test
    void selectsKeysFromDatabaseBackedJwkSet() throws Exception {
        OAuth2KeyService service = mock(OAuth2KeyService.class);
        KeyPair keyPair = TestKeySupport.generateRsaKey();
        RSAKey rsaKey =
                new RSAKey.Builder((RSAPublicKey) keyPair.getPublic())
                        .privateKey((RSAPrivateKey) keyPair.getPrivate())
                        .keyUse(KeyUse.SIGNATURE)
                        .algorithm(JWSAlgorithm.RS256)
                        .keyID("test-key")
                        .build();
        when(service.loadJwkSet()).thenReturn(new JWKSet(rsaKey));
        OAuth2KeyJwkSource source = new OAuth2KeyJwkSource(service);

        List<com.nimbusds.jose.jwk.JWK> keys =
                source.get(new JWKSelector(new JWKMatcher.Builder().build()), null);

        assertThat(keys).hasSize(1);
        assertThat(keys.getFirst().getKeyID()).isEqualTo(rsaKey.getKeyID());
    }
}
