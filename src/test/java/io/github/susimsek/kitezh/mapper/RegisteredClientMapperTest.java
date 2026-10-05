package io.github.susimsek.kitezh.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.config.security.SecurityJsonMapper;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;

class RegisteredClientMapperTest {

    private final RegisteredClientMapper mapper = Mappers.getMapper(RegisteredClientMapper.class);
    private final AuthorizationServerMapperSupport support =
            new AuthorizationServerMapperSupport(
                    new SecurityJsonMapper(getClass().getClassLoader()));

    @Test
    void mapsRegisteredClientRoundTrip() {
        Instant now = Instant.EPOCH;
        RegisteredClient registeredClient =
                RegisteredClient.withId("id-1")
                        .clientId("demo-client")
                        .clientIdIssuedAt(now)
                        .clientSecret("secret")
                        .clientSecretExpiresAt(now.plusSeconds(60))
                        .clientName("Demo")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                        .redirectUri("https://example.com/callback")
                        .postLogoutRedirectUri("https://example.com/logout")
                        .scope("openid")
                        .scope("profile")
                        .clientSettings(ClientSettings.builder().requireProofKey(true).build())
                        .tokenSettings(
                                TokenSettings.builder()
                                        .accessTokenTimeToLive(Duration.ofMinutes(5))
                                        .build())
                        .build();

        var entity = mapper.toEntity(registeredClient, support);
        var mappedBack = mapper.toObject(entity, support);

        assertThat(entity.getClientId()).isEqualTo("demo-client");
        assertThat(entity.getAuthorizationGrantTypes())
                .contains("authorization_code")
                .contains("refresh_token");
        assertThat(entity.getScopes()).contains("openid").contains("profile");
        assertThat(mappedBack.getId()).isEqualTo("id-1");
        assertThat(mappedBack.getClientAuthenticationMethods())
                .extracting(ClientAuthenticationMethod::getValue)
                .contains("client_secret_basic");
        assertThat(mappedBack.getAuthorizationGrantTypes())
                .extracting(AuthorizationGrantType::getValue)
                .contains("authorization_code", "refresh_token");
        assertThat(mappedBack.getScopes()).contains("openid", "profile");
        assertThat(mappedBack.getClientSettings().isRequireProofKey()).isTrue();
        assertThat(mappedBack.getTokenSettings().getAccessTokenTimeToLive())
                .isEqualTo(Duration.ofMinutes(5));
    }
}
