package io.github.susimsek.kitezh.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;

class AdminClientMapperTest {

    private final AdminClientMapper mapper = Mappers.getMapper(AdminClientMapper.class);

    @Test
    void mapsClientsThatOmitGrantSpecificTokenLifetimes() {
        RegisteredClient client =
                RegisteredClient.withId("personal-access-token")
                        .clientId("mcp-personal-access-token")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .scope("mcp.read")
                        .tokenSettings(
                                TokenSettings.withSettings(
                                                Map.of(
                                                        AdminClientMapper.ACCESS_TOKEN_TTL,
                                                        Duration.ofDays(90)))
                                        .build())
                        .build();

        var result = mapper.toDTO(client);

        assertThat(result.authorizationCodeTimeToLive()).isNull();
        assertThat(result.accessTokenTimeToLive()).isEqualTo(Duration.ofDays(90));
        assertThat(result.refreshTokenTimeToLive()).isNull();
    }
}
