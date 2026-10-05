package io.github.susimsek.kitezh.domain;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.domain.HibernateProxySupport.ProxyOAuth2KeyEntity;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class OAuth2KeyEntityTest {

    @Test
    void accessorsAndEqualityWork() {
        OAuth2KeyEntity entity =
                new OAuth2KeyEntity(
                        "id-1", "RSA", "RS256", "public", "private", true, "kid-1", "sig");
        entity.setCreatedBy("system");
        entity.setCreatedAt(Instant.EPOCH);
        entity.setLastModifiedBy("system");
        entity.setUpdatedAt(Instant.EPOCH);
        OAuth2KeyEntity same = new OAuth2KeyEntity();
        same.setId("id-1");
        OAuth2KeyEntity different = new OAuth2KeyEntity();
        different.setId("id-2");
        OAuth2KeyEntity withoutId = new OAuth2KeyEntity();

        assertThat(entity.getType()).isEqualTo("RSA");
        assertThat(entity.getAlgorithm()).isEqualTo("RS256");
        assertThat(entity.getPublicKey()).isEqualTo("public");
        assertThat(entity.getPrivateKey()).isEqualTo("private");
        assertThat(entity.isActive()).isTrue();
        assertThat(entity.getKid()).isEqualTo("kid-1");
        assertThat(entity.getUse()).isEqualTo("sig");
        assertThat(entity.getCreatedBy()).isEqualTo("system");
        assertThat(entity.getCreatedAt()).isEqualTo(Instant.EPOCH);
        assertThat(entity.getLastModifiedBy()).isEqualTo("system");
        assertThat(entity.getUpdatedAt()).isEqualTo(Instant.EPOCH);
        assertThat(entity)
                .isEqualTo(entity)
                .isEqualTo(same)
                .isNotEqualTo(different)
                .isNotEqualTo(withoutId)
                .isNotEqualTo(null)
                .isNotEqualTo("key")
                .hasSameHashCodeAs(OAuth2KeyEntity.class);
    }

    @Test
    void equalitySupportsHibernateProxy() {
        OAuth2KeyEntity entity = new OAuth2KeyEntity();
        entity.setId("id-1");
        ProxyOAuth2KeyEntity proxy = new ProxyOAuth2KeyEntity(OAuth2KeyEntity.class);
        proxy.setId("id-1");

        assertThat(entity).isEqualTo(proxy);
        assertThat(proxy).isEqualTo(entity).hasSameHashCodeAs(OAuth2KeyEntity.class);
    }
}
