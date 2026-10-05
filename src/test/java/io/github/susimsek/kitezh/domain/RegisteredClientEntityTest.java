package io.github.susimsek.kitezh.domain;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.domain.HibernateProxySupport.ProxyRegisteredClientEntity;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class RegisteredClientEntityTest {

    @Test
    void accessorsAndEqualityWork() {
        RegisteredClientEntity entity = new RegisteredClientEntity();
        Instant now = Instant.EPOCH;

        entity.setId("id-1");
        entity.setClientId("client");
        entity.setClientIdIssuedAt(now);
        entity.setClientSecret("secret");
        entity.setClientSecretExpiresAt(now.plusSeconds(1));
        entity.setClientName("Demo");
        entity.setClientAuthenticationMethods("client_secret_basic");
        entity.setAuthorizationGrantTypes("authorization_code,refresh_token");
        entity.setRedirectUris("https://example.com/callback");
        entity.setPostLogoutRedirectUris("https://example.com/logout");
        entity.setScopes("openid,profile");
        entity.setClientSettings("{\"key\":\"value\"}");
        entity.setTokenSettings("{\"reuseRefreshTokens\":false}");

        RegisteredClientEntity same = new RegisteredClientEntity();
        same.setId("id-1");
        RegisteredClientEntity different = new RegisteredClientEntity();
        different.setId("id-2");
        RegisteredClientEntity withoutId = new RegisteredClientEntity();

        assertThat(entity.getId()).isEqualTo("id-1");
        assertThat(entity.getClientId()).isEqualTo("client");
        assertThat(entity.getClientIdIssuedAt()).isEqualTo(now);
        assertThat(entity.getClientSecret()).isEqualTo("secret");
        assertThat(entity.getClientSecretExpiresAt()).isEqualTo(now.plusSeconds(1));
        assertThat(entity.getClientName()).isEqualTo("Demo");
        assertThat(entity.getClientAuthenticationMethods()).isEqualTo("client_secret_basic");
        assertThat(entity.getAuthorizationGrantTypes())
                .isEqualTo("authorization_code,refresh_token");
        assertThat(entity.getRedirectUris()).isEqualTo("https://example.com/callback");
        assertThat(entity.getPostLogoutRedirectUris()).isEqualTo("https://example.com/logout");
        assertThat(entity.getScopes()).isEqualTo("openid,profile");
        assertThat(entity.getClientSettings()).contains("key");
        assertThat(entity.getTokenSettings()).contains("reuseRefreshTokens");
        assertThat(entity)
                .isEqualTo(entity)
                .isEqualTo(same)
                .isNotEqualTo(different)
                .isNotEqualTo(withoutId)
                .isNotEqualTo(null)
                .isNotEqualTo("registeredClient")
                .hasSameHashCodeAs(RegisteredClientEntity.class);
    }

    @Test
    void equalitySupportsHibernateProxy() {
        RegisteredClientEntity entity = new RegisteredClientEntity();
        entity.setId("id-1");
        ProxyRegisteredClientEntity proxy =
                new ProxyRegisteredClientEntity(RegisteredClientEntity.class);
        proxy.setId("id-1");

        assertThat(entity).isEqualTo(proxy);
        assertThat(proxy).isEqualTo(entity).hasSameHashCodeAs(RegisteredClientEntity.class);
    }
}
