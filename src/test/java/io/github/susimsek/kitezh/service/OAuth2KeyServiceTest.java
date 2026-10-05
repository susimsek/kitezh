package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.nimbusds.jose.jwk.JWKSet;
import io.github.susimsek.kitezh.domain.OAuth2KeyEntity;
import io.github.susimsek.kitezh.mapper.OAuth2KeyMapper;
import io.github.susimsek.kitezh.repository.OAuth2KeyRepository;
import io.github.susimsek.kitezh.security.TestKeySupport;
import java.security.KeyPair;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataRetrievalFailureException;

class OAuth2KeyServiceTest {

    private final OAuth2KeyRepository repository = mock(OAuth2KeyRepository.class);
    private final OAuth2KeyMapper mapper = new OAuth2KeyMapper();
    private final OAuth2KeyService service = new OAuth2KeyService(repository, mapper);

    @Test
    void loadsActiveAndPassiveKeys() {
        OAuth2KeyEntity active = key("active", true);
        OAuth2KeyEntity passive = key("passive", false);
        when(repository.findAllKeys()).thenReturn(List.of(active, passive));

        JWKSet jwkSet = service.loadJwkSet();

        assertThat(jwkSet.getKeys()).hasSize(2);
        assertThat(jwkSet.getKeyByKeyId("active").isPrivate()).isTrue();
        assertThat(jwkSet.getKeyByKeyId("passive").isPrivate()).isFalse();
    }

    @Test
    void rejectsMissingKeys() {
        when(repository.findAllKeys()).thenReturn(List.of());

        assertThatThrownBy(service::loadJwkSet)
                .isInstanceOf(DataRetrievalFailureException.class)
                .hasMessage("No OAuth2 keys found");
    }

    @Test
    void rejectsMissingActiveKey() {
        when(repository.findAllKeys()).thenReturn(List.of(key("passive", false)));

        assertThatThrownBy(service::loadJwkSet)
                .isInstanceOf(DataRetrievalFailureException.class)
                .hasMessage("Exactly one active OAuth2 signing key is required");
    }

    @Test
    void rejectsMultipleActiveKeys() {
        when(repository.findAllKeys()).thenReturn(List.of(key("first", true), key("second", true)));

        assertThatThrownBy(service::loadJwkSet)
                .isInstanceOf(DataRetrievalFailureException.class)
                .hasMessage("Exactly one active OAuth2 signing key is required");
    }

    @Test
    void rejectsUnsupportedKeyType() {
        OAuth2KeyEntity key = key("key", true);
        key.setType("EC");
        when(repository.findAllKeys()).thenReturn(List.of(key));

        assertThatThrownBy(service::loadJwkSet)
                .isInstanceOf(DataRetrievalFailureException.class)
                .hasMessage("Unsupported OAuth2 key type: EC");
    }

    private static OAuth2KeyEntity key(String kid, boolean active) {
        KeyPair keyPair = TestKeySupport.generateRsaKey();
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
