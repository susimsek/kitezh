package io.github.susimsek.kitezh.service;

import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import io.github.susimsek.kitezh.domain.OAuth2KeyEntity;
import io.github.susimsek.kitezh.mapper.OAuth2KeyMapper;
import io.github.susimsek.kitezh.repository.OAuth2KeyRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OAuth2KeyService {

    private static final String RSA_KEY_TYPE = "RSA";

    private final OAuth2KeyRepository oauth2KeyRepository;
    private final OAuth2KeyMapper oauth2KeyMapper;

    @Transactional(readOnly = true)
    public JWKSet loadJwkSet() {
        List<OAuth2KeyEntity> keyEntities = oauth2KeyRepository.findAllKeys();

        if (keyEntities.isEmpty()) {
            throw new DataRetrievalFailureException("No OAuth2 keys found");
        }

        keyEntities.forEach(OAuth2KeyService::validateKey);
        validateActiveKey(keyEntities);

        List<JWK> keys = keyEntities.stream().map(oauth2KeyMapper::toJwk).toList();

        return new JWKSet(keys);
    }

    private static void validateActiveKey(List<OAuth2KeyEntity> keyEntities) {
        long activeKeyCount = keyEntities.stream().filter(OAuth2KeyEntity::isActive).count();
        if (activeKeyCount != 1) {
            throw new DataRetrievalFailureException(
                    "Exactly one active OAuth2 signing key is required");
        }
    }

    private static void validateKey(OAuth2KeyEntity keyEntity) {
        if (!RSA_KEY_TYPE.equalsIgnoreCase(keyEntity.getType())) {
            throw new DataRetrievalFailureException(
                    "Unsupported OAuth2 key type: " + keyEntity.getType());
        }
    }
}
