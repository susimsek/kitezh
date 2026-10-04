package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.domain.OAuth2KeyEntity;
import io.github.susimsek.kitezh.mapper.AdminKeyMapper;
import io.github.susimsek.kitezh.mapper.AdminServerInfoMapper;
import io.github.susimsek.kitezh.repository.OAuth2KeyRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.boot.session.autoconfigure.SessionProperties;

class AdminServerInfoServiceTest {

    @Test
    void exposesRuntimeEndpointsSessionTimeoutAndActiveSigningKey() {
        ApplicationProperties properties =
                new ApplicationProperties(
                        new ApplicationProperties.Cache(
                                new ApplicationProperties.Caffeine(Duration.ofHours(1), 50, 100)),
                        new ApplicationProperties.Session("0 * * * * *"),
                        new ApplicationProperties.AuthorizationServer("https://issuer.example"),
                        new ApplicationProperties.Mail(
                                false, "no-reply@localhost", "https://issuer.example"));
        SessionProperties sessionProperties = new SessionProperties();
        sessionProperties.setTimeout(Duration.ofMinutes(30));
        OAuth2KeyRepository keyRepository = mock(OAuth2KeyRepository.class);
        OAuth2KeyEntity inactive = key(false, "old", Instant.parse("2026-01-01T00:00:00Z"));
        OAuth2KeyEntity active = key(true, "active", Instant.parse("2026-02-01T00:00:00Z"));
        when(keyRepository.findAllKeys()).thenReturn(List.of(inactive, active));

        AdminServerInfoService service =
                new AdminServerInfoService(
                        properties,
                        sessionProperties,
                        keyRepository,
                        Mappers.getMapper(AdminKeyMapper.class),
                        Mappers.getMapper(AdminServerInfoMapper.class));

        var result = service.serverInfo();

        assertThat(result.issuer()).isEqualTo("https://issuer.example");
        assertThat(result.discoveryEndpoint())
                .isEqualTo("https://issuer.example/.well-known/openid-configuration");
        assertThat(result.authorizationEndpoint())
                .isEqualTo("https://issuer.example/oauth2/authorize");
        assertThat(result.tokenEndpoint()).isEqualTo("https://issuer.example/oauth2/token");
        assertThat(result.introspectionEndpoint())
                .isEqualTo("https://issuer.example/oauth2/introspect");
        assertThat(result.revocationEndpoint()).isEqualTo("https://issuer.example/oauth2/revoke");
        assertThat(result.jwksEndpoint()).isEqualTo("https://issuer.example/oauth2/jwks");
        assertThat(result.userInfoEndpoint()).isEqualTo("https://issuer.example/userinfo");
        assertThat(result.endSessionEndpoint()).isEqualTo("https://issuer.example/connect/logout");
        assertThat(result.sessionTimeout()).isEqualTo("PT30M");
        assertThat(result.activeSigningKey()).isNotNull();
        assertThat(result.activeSigningKey().kid()).isEqualTo("active");
        assertThat(result.activeSigningKey().algorithm()).isEqualTo("RS256");
    }

    private static OAuth2KeyEntity key(boolean active, String kid, Instant createdAt) {
        OAuth2KeyEntity key = mock(OAuth2KeyEntity.class);
        when(key.isActive()).thenReturn(active);
        when(key.getKid()).thenReturn(kid);
        when(key.getType()).thenReturn("RSA");
        when(key.getAlgorithm()).thenReturn("RS256");
        when(key.getUse()).thenReturn("sig");
        when(key.getCreatedAt()).thenReturn(createdAt);
        return key;
    }
}
