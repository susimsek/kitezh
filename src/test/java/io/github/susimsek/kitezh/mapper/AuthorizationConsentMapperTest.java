package io.github.susimsek.kitezh.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.config.security.SecurityJsonMapper;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsent;

class AuthorizationConsentMapperTest {

    private final AuthorizationConsentMapper mapper =
            Mappers.getMapper(AuthorizationConsentMapper.class);
    private final AuthorizationServerMapperSupport support =
            new AuthorizationServerMapperSupport(
                    new SecurityJsonMapper(getClass().getClassLoader()));

    @Test
    void mapsAuthorizationConsentRoundTrip() {
        OAuth2AuthorizationConsent consent =
                OAuth2AuthorizationConsent.withId("client", "admin")
                        .authority(new SimpleGrantedAuthority("ROLE_ADMIN"))
                        .authority(new SimpleGrantedAuthority("SCOPE_openid"))
                        .build();

        var entity = mapper.toEntity(consent, support);
        var mappedBack = mapper.toObject(entity, support);

        assertThat(entity.getId().getRegisteredClientId()).isEqualTo("client");
        assertThat(entity.getAuthorities()).contains("ROLE_ADMIN").contains("SCOPE_openid");
        assertThat(mappedBack.getRegisteredClientId()).isEqualTo("client");
        assertThat(mappedBack.getPrincipalName()).isEqualTo("admin");
        assertThat(mappedBack.getAuthorities())
                .extracting(Object::toString)
                .containsExactlyInAnyOrder("ROLE_ADMIN", "SCOPE_openid");
        assertThat(
                        mapper.writeAuthorities(
                                Set.of(new SimpleGrantedAuthority("ROLE_ADMIN")), support))
                .isEqualTo("ROLE_ADMIN");
    }
}
