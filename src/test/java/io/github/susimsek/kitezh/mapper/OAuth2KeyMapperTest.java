package io.github.susimsek.kitezh.mapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nimbusds.jose.jwk.RSAKey;
import io.github.susimsek.kitezh.domain.OAuth2KeyEntity;
import io.github.susimsek.kitezh.security.TestKeySupport;
import java.security.KeyPair;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataRetrievalFailureException;

class OAuth2KeyMapperTest {

    private final OAuth2KeyMapper mapper = new OAuth2KeyMapper();

    @Test
    void mapsActiveEntityToPrivateRsaJwk() {
        KeyPair keyPair = TestKeySupport.generateRsaKey();

        OAuth2KeyEntity entity = key("active", keyPair, true);

        RSAKey jwk = mapper.toJwk(entity).toRSAKey();

        assertThat(jwk.getKeyID()).isEqualTo("active");
        assertThat(jwk.getAlgorithm().getName()).isEqualTo("RS256");
        assertThat(jwk.getKeyUse().identifier()).isEqualTo("sig");
        assertThat(jwk.isPrivate()).isTrue();
    }

    @Test
    void mapsInactiveEntityToPublicOnlyRsaJwk() {
        KeyPair keyPair = TestKeySupport.generateRsaKey();

        OAuth2KeyEntity entity = key("inactive", keyPair, false);

        RSAKey jwk = mapper.toJwk(entity).toRSAKey();

        assertThat(jwk.isPrivate()).isFalse();
    }

    @Test
    void supportsBlankOptionalMetadata() {
        KeyPair keyPair = TestKeySupport.generateRsaKey();
        OAuth2KeyEntity entity = key("key", keyPair, false);
        entity.setAlgorithm(null);
        entity.setUse(" ");

        RSAKey jwk = mapper.toJwk(entity).toRSAKey();

        assertThat(jwk.getAlgorithm()).isNull();
        assertThat(jwk.getKeyUse()).isNull();
    }

    @Test
    void wrapsInvalidKeyMaterial() {
        OAuth2KeyEntity entity =
                new OAuth2KeyEntity("id", "RSA", "RS256", "invalid", "invalid", true, "kid", "sig");

        assertThatThrownBy(() -> mapper.toJwk(entity))
                .isInstanceOf(DataRetrievalFailureException.class)
                .hasMessage("Failed to load OAuth2 RSA key: kid");
    }

    private static OAuth2KeyEntity key(String kid, KeyPair keyPair, boolean active) {
        return new OAuth2KeyEntity(
                kid,
                "RSA",
                "RS256",
                Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded()),
                Base64.getEncoder().encodeToString(keyPair.getPrivate().getEncoded()),
                active,
                kid,
                "sig");
    }
}
