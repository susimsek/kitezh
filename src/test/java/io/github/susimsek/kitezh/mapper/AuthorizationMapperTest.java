package io.github.susimsek.kitezh.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.config.security.SecurityJsonMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2DeviceCode;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2UserCode;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.StandardClaimNames;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization.Token;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationCode;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;

class AuthorizationMapperTest {

    private final AuthorizationMapper mapper = new AuthorizationMapper();
    private final AuthorizationServerMapperSupport support =
            new AuthorizationServerMapperSupport(
                    new SecurityJsonMapper(getClass().getClassLoader()));

    @Test
    void mapsAuthorizationRoundTripWithAllTokenTypes() {
        RegisteredClient registeredClient = registeredClient();
        Instant issuedAt = Instant.EPOCH;
        Instant expiresAt = issuedAt.plusSeconds(300);
        Map<String, Object> idTokenClaims = new LinkedHashMap<>();
        idTokenClaims.put(StandardClaimNames.SUB, "admin");
        idTokenClaims.put("claim", "value");
        OAuth2Authorization authorization =
                OAuth2Authorization.withRegisteredClient(registeredClient)
                        .id("auth-1")
                        .principalName("admin")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .authorizedScopes(Set.of("openid", "profile"))
                        .attribute(OAuth2ParameterNames.STATE, "state-1")
                        .attribute("custom", "value")
                        .token(
                                new OAuth2AuthorizationCode("code-1", issuedAt, expiresAt),
                                metadata -> metadata.put("code-meta", "yes"))
                        .token(
                                new OAuth2AccessToken(
                                        OAuth2AccessToken.TokenType.BEARER,
                                        "access-1",
                                        issuedAt,
                                        expiresAt,
                                        Set.of("openid")),
                                metadata -> metadata.put("access-meta", "yes"))
                        .token(
                                new OidcIdToken("id-1", issuedAt, expiresAt, idTokenClaims),
                                metadata -> {
                                    metadata.put("id-meta", "yes");
                                    metadata.put(Token.CLAIMS_METADATA_NAME, idTokenClaims);
                                })
                        .token(
                                new OAuth2RefreshToken(
                                        "refresh-1", issuedAt, expiresAt.plusSeconds(300)),
                                metadata -> metadata.put("refresh-meta", "yes"))
                        .token(
                                new OAuth2UserCode("user-1", issuedAt, expiresAt),
                                metadata -> metadata.put("user-meta", "yes"))
                        .token(
                                new OAuth2DeviceCode("device-1", issuedAt, expiresAt),
                                metadata -> metadata.put("device-meta", "yes"))
                        .build();

        var entity = mapper.toEntity(authorization, support);
        var mappedBack = mapper.toObject(entity, registeredClient, support);

        assertThat(entity.getAuthorizationCodeValue()).isEqualTo("code-1");
        assertThat(entity.getAccessTokenValue()).isEqualTo("access-1");
        assertThat(entity.getOidcIdTokenValue()).isEqualTo("id-1");
        assertThat(entity.getRefreshTokenValue()).isEqualTo("refresh-1");
        assertThat(entity.getUserCodeValue()).isEqualTo("user-1");
        assertThat(entity.getDeviceCodeValue()).isEqualTo("device-1");
        assertThat(entity.getOidcIdTokenClaims()).contains("admin");

        assertThat(mappedBack.getId()).isEqualTo("auth-1");
        assertThat(mappedBack.getPrincipalName()).isEqualTo("admin");
        assertThat(mappedBack.getAuthorizedScopes()).containsExactlyInAnyOrder("openid", "profile");
        assertThat(mappedBack.<String>getAttribute(OAuth2ParameterNames.STATE))
                .isEqualTo("state-1");
        assertThat(mappedBack.getToken(OAuth2AuthorizationCode.class).getToken().getTokenValue())
                .isEqualTo("code-1");
        assertThat(mappedBack.getToken(OAuth2AccessToken.class).getToken().getTokenValue())
                .isEqualTo("access-1");
        assertThat(
                        mappedBack
                                .getToken(OidcIdToken.class)
                                .getToken()
                                .getClaimAsString(StandardClaimNames.SUB))
                .isEqualTo("admin");
        assertThat(mappedBack.getRefreshToken().getToken().getTokenValue()).isEqualTo("refresh-1");
        assertThat(mappedBack.getToken(OAuth2UserCode.class).getToken().getTokenValue())
                .isEqualTo("user-1");
        assertThat(mappedBack.getToken(OAuth2DeviceCode.class).getToken().getTokenValue())
                .isEqualTo("device-1");
    }

    @Test
    void mapsAuthorizationWithoutOptionalTokens() {
        RegisteredClient registeredClient = registeredClient();
        OAuth2Authorization authorization =
                OAuth2Authorization.withRegisteredClient(registeredClient)
                        .id("auth-2")
                        .principalName("service")
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .build();

        var entity = mapper.toEntity(authorization, support);
        var mappedBack = mapper.toObject(entity, registeredClient, support);

        assertThat(entity.getAccessTokenValue()).isNull();
        assertThat(entity.getOidcIdTokenValue()).isNull();
        assertThat(mappedBack.getAuthorizedScopes()).isEmpty();
    }

    private static RegisteredClient registeredClient() {
        return RegisteredClient.withId("client-id")
                .clientId("demo-client")
                .clientSecret("secret")
                .clientAuthenticationMethod(
                        org.springframework.security.oauth2.core.ClientAuthenticationMethod
                                .CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .redirectUri("https://example.com/callback")
                .scope("openid")
                .scope("profile")
                .clientSettings(ClientSettings.builder().requireProofKey(true).build())
                .tokenSettings(
                        TokenSettings.builder()
                                .accessTokenTimeToLive(Duration.ofMinutes(5))
                                .build())
                .build();
    }
}
