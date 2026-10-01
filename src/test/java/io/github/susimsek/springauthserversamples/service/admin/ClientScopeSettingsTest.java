package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;

class ClientScopeSettingsTest {

    @Test
    void readsExplicitAssignmentsAndFallsBackToRegisteredScopes() {
        RegisteredClient fallback =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("https://client.example/callback")
                        .scope("openid")
                        .scope("profile")
                        .build();
        assertThat(ClientScopeSettings.defaultScopes(fallback))
                .containsExactly("openid", "profile");
        assertThat(ClientScopeSettings.optionalScopes(fallback)).isEmpty();

        ClientSettings assigned =
                ClientScopeSettings.withAssignments(
                        ClientSettings.builder().build(),
                        new LinkedHashSet<>(Set.of("email", "openid")),
                        new LinkedHashSet<>(Set.of("profile")));
        RegisteredClient configured =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .clientSettings(assigned)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("https://client.example/callback")
                        .scope("openid")
                        .build();

        assertThat(ClientScopeSettings.defaultScopes(configured))
                .containsExactly("email", "openid");
        assertThat(ClientScopeSettings.optionalScopes(configured)).containsExactly("profile");
    }

    @Test
    void doesNotGrantOfflineAccessAsAnImplicitDefaultScope() {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("https://client.example/callback")
                        .scope("openid")
                        .scope("offline_access")
                        .build();

        assertThat(ClientScopeSettings.defaultScopes(client)).containsExactly("openid");
    }

    @Test
    void ignoresBlankAndUnsupportedSettingsAndWritesSortedValues() {
        ClientSettings settings =
                ClientSettings.withSettings(
                                java.util.Map.of(
                                        ClientScopeSettings.DEFAULT_SCOPES,
                                        ",email,,openid",
                                        ClientScopeSettings.OPTIONAL_SCOPES,
                                        42))
                        .build();
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .clientSettings(settings)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("https://client.example/callback")
                        .scope("fallback")
                        .build();

        assertThat(ClientScopeSettings.defaultScopes(client)).containsExactly("email", "openid");
        assertThat(ClientScopeSettings.optionalScopes(client)).isEmpty();
        assertThat(ClientScopeSettings.write(Set.of("z", "a"))).isEqualTo("a,z");
    }
}
