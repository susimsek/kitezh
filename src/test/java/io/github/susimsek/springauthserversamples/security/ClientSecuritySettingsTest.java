package io.github.susimsek.springauthserversamples.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;

class ClientSecuritySettingsTest {

    @Test
    void readsBooleanStringAndCollectionSettings() {
        RegisteredClient enabled = client(Map.of(ClientSecuritySettings.CLIENT_ENABLED, true));
        RegisteredClient disabled = client(Map.of(ClientSecuritySettings.CLIENT_ENABLED, false));
        RegisteredClient values =
                client(
                        Map.of(
                                "string",
                                "value",
                                "blank",
                                " ",
                                "flag",
                                true,
                                "strings",
                                List.of("RS256", 42, "ES256"),
                                "notIterable",
                                42));

        assertThat(ClientSecuritySettings.isEnabled(enabled)).isTrue();
        assertThat(ClientSecuritySettings.isEnabled(disabled)).isFalse();
        assertThat(ClientSecuritySettings.stringSetting(values, "string")).isEqualTo("value");
        assertThat(ClientSecuritySettings.stringSetting(values, "blank")).isNull();
        assertThat(ClientSecuritySettings.stringSetting(values, "missing")).isNull();
        assertThat(ClientSecuritySettings.booleanSetting(values, "flag")).isTrue();
        assertThat(ClientSecuritySettings.booleanSetting(values, "missing")).isFalse();
        assertThat(ClientSecuritySettings.stringSetSetting(values, "strings"))
                .containsExactlyInAnyOrder("RS256", "ES256");
        assertThat(ClientSecuritySettings.stringSetSetting(values, "notIterable")).isEmpty();
    }

    @Test
    void resolvesDpopAndCibaDefaultsAndConfiguredValues() {
        RegisteredClient defaults = client(Map.of());
        RegisteredClient configured =
                client(
                        Map.of(
                                ClientSecuritySettings.REQUIRE_DPOP_PROOF,
                                true,
                                ClientSecuritySettings.REQUIRE_DPOP_JKT,
                                true,
                                ClientSecuritySettings.DPOP_REFRESH_TOKEN_ONLY,
                                true,
                                ClientSecuritySettings.DPOP_SIGNING_ALGORITHMS,
                                List.of("ES256"),
                                ClientSecuritySettings.CIBA_DELIVERY_MODE,
                                ClientSecuritySettings.CIBA_PUSH,
                                ClientSecuritySettings.CIBA_NOTIFICATION_ENDPOINT,
                                "https://example.test/notify",
                                ClientSecuritySettings.CIBA_CLIENT_NOTIFICATION_TOKEN,
                                "token",
                                ClientSecuritySettings.CIBA_REQUEST_SIGNING_ALGORITHMS,
                                List.of("PS256")));
        RegisteredClient invalid =
                client(
                        Map.of(
                                ClientSecuritySettings.DPOP_SIGNING_ALGORITHMS,
                                List.of(),
                                ClientSecuritySettings.CIBA_DELIVERY_MODE,
                                "invalid",
                                ClientSecuritySettings.CIBA_NOTIFICATION_ENDPOINT,
                                " ",
                                ClientSecuritySettings.CIBA_CLIENT_NOTIFICATION_TOKEN,
                                " ",
                                ClientSecuritySettings.CIBA_REQUEST_SIGNING_ALGORITHMS,
                                "RS256"));

        assertThat(ClientSecuritySettings.requiresDpopProof(defaults)).isFalse();
        assertThat(ClientSecuritySettings.requiresDpopJkt(defaults)).isFalse();
        assertThat(ClientSecuritySettings.requiresDpopForRefreshToken(defaults)).isFalse();
        assertThat(ClientSecuritySettings.allowedDpopSigningAlgorithms(defaults))
                .isEqualTo(ClientSecuritySettings.DEFAULT_DPOP_SIGNING_ALGORITHMS);
        assertThat(ClientSecuritySettings.cibaDeliveryMode(defaults))
                .isEqualTo(ClientSecuritySettings.CIBA_POLL);
        assertThat(ClientSecuritySettings.cibaNotificationEndpoint(defaults)).isNull();
        assertThat(ClientSecuritySettings.cibaClientNotificationToken(defaults)).isNull();
        assertThat(ClientSecuritySettings.allowedCibaRequestSigningAlgorithms(defaults))
                .isEqualTo(ClientSecuritySettings.DEFAULT_CIBA_REQUEST_SIGNING_ALGORITHMS);

        assertThat(ClientSecuritySettings.requiresDpopProof(configured)).isTrue();
        assertThat(ClientSecuritySettings.requiresDpopJkt(configured)).isTrue();
        assertThat(ClientSecuritySettings.requiresDpopForRefreshToken(configured)).isTrue();
        assertThat(ClientSecuritySettings.allowedDpopSigningAlgorithms(configured))
                .containsExactly("ES256");
        assertThat(ClientSecuritySettings.cibaDeliveryMode(configured))
                .isEqualTo(ClientSecuritySettings.CIBA_PUSH);
        assertThat(ClientSecuritySettings.cibaNotificationEndpoint(configured))
                .isEqualTo("https://example.test/notify");
        assertThat(ClientSecuritySettings.cibaClientNotificationToken(configured))
                .isEqualTo("token");
        assertThat(ClientSecuritySettings.allowedCibaRequestSigningAlgorithms(configured))
                .containsExactly("PS256");

        assertThat(ClientSecuritySettings.allowedDpopSigningAlgorithms(invalid))
                .isEqualTo(ClientSecuritySettings.DEFAULT_DPOP_SIGNING_ALGORITHMS);
        assertThat(ClientSecuritySettings.cibaDeliveryMode(invalid))
                .isEqualTo(ClientSecuritySettings.CIBA_POLL);
        assertThat(ClientSecuritySettings.cibaNotificationEndpoint(invalid)).isNull();
        assertThat(ClientSecuritySettings.cibaClientNotificationToken(invalid)).isNull();
        assertThat(ClientSecuritySettings.allowedCibaRequestSigningAlgorithms(invalid))
                .isEqualTo(ClientSecuritySettings.DEFAULT_CIBA_REQUEST_SIGNING_ALGORITHMS);
    }

    private static RegisteredClient client(Map<String, Object> settings) {
        return RegisteredClient.withId("client-id")
                .clientId("client")
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .clientSettings(
                        settings.isEmpty()
                                ? ClientSettings.builder().build()
                                : ClientSettings.withSettings(settings).build())
                .build();
    }
}
