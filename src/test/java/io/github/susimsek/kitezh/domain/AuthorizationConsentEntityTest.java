package io.github.susimsek.kitezh.domain;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.domain.HibernateProxySupport.ProxyAuthorizationConsentEntity;
import org.junit.jupiter.api.Test;

class AuthorizationConsentEntityTest {

    @Test
    void accessorsAndEqualityWork() {
        AuthorizationConsentId id = new AuthorizationConsentId("client", "admin");
        AuthorizationConsentEntity entity = new AuthorizationConsentEntity();
        entity.setId(id);
        entity.setAuthorities("ROLE_USER,ROLE_ADMIN");

        AuthorizationConsentEntity same =
                new AuthorizationConsentEntity(
                        new AuthorizationConsentId("client", "admin"), "ROLE_USER");
        AuthorizationConsentEntity different =
                new AuthorizationConsentEntity(
                        new AuthorizationConsentId("client", "user"), "ROLE_USER");
        AuthorizationConsentEntity withoutId = new AuthorizationConsentEntity();

        assertThat(entity.getId()).isEqualTo(id);
        assertThat(entity.getAuthorities()).isEqualTo("ROLE_USER,ROLE_ADMIN");
        assertThat(entity)
                .isEqualTo(entity)
                .isEqualTo(same)
                .isNotEqualTo(different)
                .isNotEqualTo(withoutId)
                .isNotEqualTo(null)
                .isNotEqualTo("consent")
                .hasSameHashCodeAs(AuthorizationConsentEntity.class);
    }

    @Test
    void equalitySupportsHibernateProxy() {
        AuthorizationConsentEntity entity =
                new AuthorizationConsentEntity(
                        new AuthorizationConsentId("client", "admin"), "ROLE_USER");
        ProxyAuthorizationConsentEntity proxy =
                new ProxyAuthorizationConsentEntity(AuthorizationConsentEntity.class);
        proxy.setId(new AuthorizationConsentId("client", "admin"));

        assertThat(entity).isEqualTo(proxy);
        assertThat(proxy).isEqualTo(entity).hasSameHashCodeAs(AuthorizationConsentEntity.class);
    }
}
