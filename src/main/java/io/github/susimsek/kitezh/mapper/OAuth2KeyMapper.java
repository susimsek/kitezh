package io.github.susimsek.kitezh.mapper;

import com.nimbusds.jose.Algorithm;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import io.github.susimsek.kitezh.domain.OAuth2KeyEntity;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class OAuth2KeyMapper {

    private static final String RSA_ALGORITHM = "RSA";

    public JWK toJwk(OAuth2KeyEntity entity) {
        try {
            RSAPublicKey publicKey = loadPublicKey(entity.getPublicKey());

            RSAKey.Builder builder =
                    new RSAKey.Builder(publicKey)
                            .keyUse(toKeyUse(entity.getUse()))
                            .algorithm(toAlgorithm(entity.getAlgorithm()))
                            .keyID(entity.getKid());

            if (entity.isActive()) {
                builder.privateKey(loadPrivateKey(entity.getPrivateKey()));
            }

            return builder.build();
        } catch (GeneralSecurityException | IllegalArgumentException ex) {
            throw new DataRetrievalFailureException(
                    "Failed to load OAuth2 RSA key: " + entity.getKid(), ex);
        }
    }

    private static RSAPublicKey loadPublicKey(String publicKey) throws GeneralSecurityException {
        KeyFactory keyFactory = KeyFactory.getInstance(RSA_ALGORITHM);
        return (RSAPublicKey)
                keyFactory.generatePublic(
                        new X509EncodedKeySpec(Base64.getDecoder().decode(publicKey)));
    }

    private static RSAPrivateKey loadPrivateKey(String privateKey) throws GeneralSecurityException {
        if (!StringUtils.hasText(privateKey)) {
            return null;
        }

        KeyFactory keyFactory = KeyFactory.getInstance(RSA_ALGORITHM);
        return (RSAPrivateKey)
                keyFactory.generatePrivate(
                        new PKCS8EncodedKeySpec(Base64.getDecoder().decode(privateKey)));
    }

    private static KeyUse toKeyUse(String keyUse) {
        return StringUtils.hasText(keyUse) ? new KeyUse(keyUse) : null;
    }

    private static Algorithm toAlgorithm(String algorithm) {
        return StringUtils.hasText(algorithm) ? JWSAlgorithm.parse(algorithm) : null;
    }
}
