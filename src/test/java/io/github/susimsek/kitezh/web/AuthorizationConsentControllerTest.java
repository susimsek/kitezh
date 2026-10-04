package io.github.susimsek.kitezh.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.security.Principal;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsent;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsentService;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;

class AuthorizationConsentControllerTest {

    private final RegisteredClientRepository registeredClientRepository =
            mock(RegisteredClientRepository.class);
    private final OAuth2AuthorizationConsentService authorizationConsentService =
            mock(OAuth2AuthorizationConsentService.class);
    private final AuthorizationConsentController controller =
            new AuthorizationConsentController(
                    registeredClientRepository, authorizationConsentService);

    @Test
    void returnsValidatedConsentView() {
        RegisteredClient registeredClient = registeredClient();
        when(registeredClientRepository.findByClientId("pkce-client")).thenReturn(registeredClient);

        OAuth2AuthorizationConsent consent =
                OAuth2AuthorizationConsent.withId(registeredClient.getId(), "admin")
                        .scope("profile")
                        .build();
        when(authorizationConsentService.findById(registeredClient.getId(), "admin"))
                .thenReturn(consent);

        Principal principal = () -> "admin";

        var view =
                controller.consent(
                        principal, "pkce-client", "openid profile message.read", "state-1", null);

        assertThat(view.clientId()).isEqualTo("pkce-client");
        assertThat(view.state()).isEqualTo("state-1");
        assertThat(view.scopes()).containsExactly("message.read");
        assertThat(view.previouslyApprovedScopes()).containsExactly("profile");
        assertThat(view.requestUri()).isEqualTo("/oauth2/authorize");
    }

    @Test
    void rejectsUnknownClient() {
        Principal principal = () -> "admin";

        assertThatThrownBy(
                        () ->
                                controller.consent(
                                        principal, "unknown-client", "openid", "state-1", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid client");
    }

    private static RegisteredClient registeredClient() {
        return RegisteredClient.withId("client-id")
                .clientId("pkce-client")
                .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("http://127.0.0.1:8082/callback")
                .scope("openid")
                .scope("profile")
                .scope("message.read")
                .build();
    }
}
