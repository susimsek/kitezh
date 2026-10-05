package io.github.susimsek.kitezh.domain;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.domain.HibernateProxySupport.ProxyAuthorizationEntity;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class AuthorizationEntityTest {

    @Test
    void accessorsAndEqualityWork() {
        AuthorizationEntity entity = new AuthorizationEntity();
        Instant now = Instant.EPOCH;
        entity.setId("auth-1");
        entity.setRegisteredClientId("client");
        entity.setPrincipalName("admin");
        entity.setAuthorizationGrantType("authorization_code");
        entity.setAuthorizedScopes("openid,profile");
        entity.setAttributes("{\"k\":\"v\"}");
        entity.setState("state");
        entity.setAuthorizationCodeValue("code");
        entity.setAuthorizationCodeIssuedAt(now);
        entity.setAuthorizationCodeExpiresAt(now.plusSeconds(60));
        entity.setAuthorizationCodeMetadata("{\"m\":\"v\"}");
        entity.setAccessTokenValue("access");
        entity.setAccessTokenIssuedAt(now);
        entity.setAccessTokenExpiresAt(now.plusSeconds(60));
        entity.setAccessTokenMetadata("{\"m\":\"v\"}");
        entity.setAccessTokenType("Bearer");
        entity.setAccessTokenScopes("openid");
        entity.setOidcIdTokenValue("idtoken");
        entity.setOidcIdTokenIssuedAt(now);
        entity.setOidcIdTokenExpiresAt(now.plusSeconds(60));
        entity.setOidcIdTokenMetadata("{\"m\":\"v\"}");
        entity.setOidcIdTokenClaims("{\"sub\":\"admin\"}");
        entity.setRefreshTokenValue("refresh");
        entity.setRefreshTokenIssuedAt(now);
        entity.setRefreshTokenExpiresAt(now.plusSeconds(120));
        entity.setRefreshTokenMetadata("{\"m\":\"v\"}");
        entity.setUserCodeValue("user");
        entity.setUserCodeIssuedAt(now);
        entity.setUserCodeExpiresAt(now.plusSeconds(120));
        entity.setUserCodeMetadata("{\"m\":\"v\"}");
        entity.setDeviceCodeValue("device");
        entity.setDeviceCodeIssuedAt(now);
        entity.setDeviceCodeExpiresAt(now.plusSeconds(120));
        entity.setDeviceCodeMetadata("{\"m\":\"v\"}");

        AuthorizationEntity same = new AuthorizationEntity();
        same.setId("auth-1");
        AuthorizationEntity different = new AuthorizationEntity();
        different.setId("auth-2");
        AuthorizationEntity withoutId = new AuthorizationEntity();

        assertThat(entity.getId()).isEqualTo("auth-1");
        assertThat(entity.getRegisteredClientId()).isEqualTo("client");
        assertThat(entity.getPrincipalName()).isEqualTo("admin");
        assertThat(entity.getAuthorizationGrantType()).isEqualTo("authorization_code");
        assertThat(entity.getDeviceCodeMetadata()).contains("m");
        assertThat(entity)
                .isEqualTo(entity)
                .isEqualTo(same)
                .isNotEqualTo(different)
                .isNotEqualTo(withoutId)
                .isNotEqualTo(null)
                .isNotEqualTo("authorization")
                .hasSameHashCodeAs(AuthorizationEntity.class);
    }

    @Test
    void equalitySupportsHibernateProxy() {
        AuthorizationEntity entity = new AuthorizationEntity();
        entity.setId("auth-1");
        ProxyAuthorizationEntity proxy = new ProxyAuthorizationEntity(AuthorizationEntity.class);
        proxy.setId("auth-1");

        assertThat(entity).isEqualTo(proxy);
        assertThat(proxy).isEqualTo(entity).hasSameHashCodeAs(AuthorizationEntity.class);
    }
}
