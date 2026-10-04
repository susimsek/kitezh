package io.github.susimsek.kitezh.domain;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.domain.HibernateProxySupport.ProxyUserEntity;
import java.time.Instant;
import java.util.HashSet;
import org.junit.jupiter.api.Test;

class UserEntityTest {

    @Test
    void accessorsAndEqualityWork() {
        AuthorityEntity authority = new AuthorityEntity(1L, "ROLE_USER");
        HashSet<AuthorityEntity> authorities = new HashSet<>();
        authorities.add(authority);
        UserEntity user = new UserEntity();
        String createdBy = "system";
        Instant createdAt = Instant.EPOCH;
        String lastModifiedBy = "admin";
        Instant updatedAt = Instant.EPOCH.plusSeconds(1);

        user.setId(1L);
        user.setUsername("admin");
        user.setPassword("secret");
        user.setEnabled(true);
        user.setAuthorities(authorities);
        user.setCreatedBy(createdBy);
        user.setCreatedAt(createdAt);
        user.setLastModifiedBy(lastModifiedBy);
        user.setUpdatedAt(updatedAt);

        UserEntity same = new UserEntity(1L, "other", "other", false, new HashSet<>());
        UserEntity different = new UserEntity(2L, "admin", "secret", true, authorities);
        UserEntity withoutId = new UserEntity(null, "admin", "secret", true, authorities);
        UserEntity otherWithoutId = new UserEntity(null, "other", "other", false, new HashSet<>());

        assertThat(user.getId()).isEqualTo(1L);
        assertThat(user.getUsername()).isEqualTo("admin");
        assertThat(user.getPassword()).isEqualTo("secret");
        assertThat(user.isEnabled()).isTrue();
        assertThat(user.getAuthorities()).containsExactly(authority);
        assertThat(user.getCreatedBy()).isEqualTo(createdBy);
        assertThat(user.getCreatedAt()).isEqualTo(createdAt);
        assertThat(user.getLastModifiedBy()).isEqualTo(lastModifiedBy);
        assertThat(user.getUpdatedAt()).isEqualTo(updatedAt);
        assertThat(new UserEntity().getAuthorities()).isEmpty();
        assertThat(user)
                .isEqualTo(user)
                .isEqualTo(same)
                .isNotEqualTo(different)
                .isNotEqualTo(withoutId)
                .isNotEqualTo(otherWithoutId)
                .isNotEqualTo(null)
                .isNotEqualTo("user")
                .hasSameHashCodeAs(UserEntity.class);
        assertThat(withoutId).isNotEqualTo(user);
    }

    @Test
    void equalitySupportsHibernateProxy() {
        UserEntity user = new UserEntity(1L, "admin", "secret", true, new HashSet<>());
        ProxyUserEntity proxy = new ProxyUserEntity(UserEntity.class);
        proxy.setId(1L);

        assertThat(user).isEqualTo(proxy);
        assertThat(proxy).isEqualTo(user).hasSameHashCodeAs(UserEntity.class);
    }
}
