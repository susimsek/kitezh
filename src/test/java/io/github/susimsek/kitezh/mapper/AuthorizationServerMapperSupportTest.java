package io.github.susimsek.kitezh.mapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.github.susimsek.kitezh.config.security.SecurityJsonMapper;
import io.github.susimsek.kitezh.domain.AuthorizationConsentId;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;

class AuthorizationServerMapperSupportTest {

    private final AuthorizationServerMapperSupport support =
            new AuthorizationServerMapperSupport(
                    new SecurityJsonMapper(getClass().getClassLoader()));

    @Test
    void readsAndWritesAuthorizationServerTypes() {
        Set<ClientAuthenticationMethod> clientMethods =
                new LinkedHashSet<>(Set.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC));
        Set<AuthorizationGrantType> grantTypes =
                new LinkedHashSet<>(Set.of(AuthorizationGrantType.AUTHORIZATION_CODE));
        Set<String> values = new LinkedHashSet<>(Set.of("openid", "profile"));
        Set<org.springframework.security.core.GrantedAuthority> authorities =
                new LinkedHashSet<>(Set.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        ClientSettings clientSettings = ClientSettings.builder().requireProofKey(true).build();
        TokenSettings tokenSettings =
                TokenSettings.builder().accessTokenTimeToLive(Duration.ofMinutes(5)).build();

        assertThat(support.newAuthorizationConsentId("client", "admin"))
                .isEqualTo(new AuthorizationConsentId("client", "admin"));
        assertThat(
                        support.readClientAuthenticationMethods(
                                support.writeClientAuthenticationMethods(clientMethods)))
                .extracting(ClientAuthenticationMethod::getValue)
                .containsExactly("client_secret_basic");
        assertThat(
                        support.readAuthorizationGrantTypes(
                                support.writeAuthorizationGrantTypes(grantTypes)))
                .extracting(AuthorizationGrantType::getValue)
                .containsExactly("authorization_code");
        assertThat(support.readCollection(support.writeCollection(values)))
                .containsExactlyInAnyOrder("openid", "profile");
        assertThat(support.readAuthorities(support.writeAuthorities(authorities)))
                .extracting(Object::toString)
                .containsExactly("ROLE_ADMIN");
        assertThat(
                        support.readClientSettings(support.writeClientSettings(clientSettings))
                                .isRequireProofKey())
                .isTrue();
        assertThat(
                        support.readTokenSettings(support.writeTokenSettings(tokenSettings))
                                .getAccessTokenTimeToLive())
                .isEqualTo(Duration.ofMinutes(5));
    }

    @Test
    void handlesNullAndInvalidValues() {
        assertThat(support.writeCollection(Set.of())).isNull();
        assertThat(support.readCollection(null)).isEmpty();
        assertThat(support.writeMap(Map.of())).isNull();
        assertThat(support.readMap(null)).isEmpty();
        assertThat(
                        support.readMap(
                                """
                                {"@class":"java.util.Collections$UnmodifiableMap","settings.client.require-proof-key":false}
                                """))
                .containsEntry("settings.client.require-proof-key", false);
        assertThatThrownBy(() -> support.readMap("{not-json"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Failed to deserialize authorization server value");
    }
}
