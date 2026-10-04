package io.github.susimsek.kitezh.domain;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.domain.HibernateProxySupport.ProxyAuthorityEntity;
import org.junit.jupiter.api.Test;

class AuthorityEntityTest {

    @Test
    void accessorsAndEqualityWork() {
        AuthorityEntity authority = new AuthorityEntity();

        authority.setId(1L);
        authority.setName("ROLE_ADMIN");

        AuthorityEntity same = new AuthorityEntity(1L, "ROLE_USER");
        AuthorityEntity different = new AuthorityEntity(2L, "ROLE_ADMIN");
        AuthorityEntity withoutId = new AuthorityEntity(null, "ROLE_ADMIN");
        AuthorityEntity otherWithoutId = new AuthorityEntity(null, "ROLE_USER");

        assertThat(authority.getId()).isEqualTo(1L);
        assertThat(authority.getName()).isEqualTo("ROLE_ADMIN");
        assertThat(authority)
                .isEqualTo(authority)
                .isEqualTo(same)
                .isNotEqualTo(different)
                .isNotEqualTo(withoutId)
                .isNotEqualTo(otherWithoutId)
                .isNotEqualTo(null)
                .isNotEqualTo("authority")
                .hasSameHashCodeAs(AuthorityEntity.class);
        assertThat(withoutId).isNotEqualTo(authority);
    }

    @Test
    void equalitySupportsHibernateProxy() {
        AuthorityEntity authority = new AuthorityEntity(1L, "ROLE_ADMIN");
        ProxyAuthorityEntity proxy = new ProxyAuthorityEntity(AuthorityEntity.class);
        proxy.setId(1L);

        assertThat(authority).isEqualTo(proxy);
        assertThat(proxy).isEqualTo(authority).hasSameHashCodeAs(AuthorityEntity.class);
    }
}
