package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;

class ConsolePublicClientAuthenticationProviderTest {

    private final RegisteredClientRepository repository = mock(RegisteredClientRepository.class);
    private final ConsolePublicClientAuthenticationProvider provider =
            new ConsolePublicClientAuthenticationProvider(repository);

    @Test
    void returnsNullForUnsupportedAuthentication() {
        OAuth2ClientAuthenticationToken token =
                new OAuth2ClientAuthenticationToken(
                        "admin-console",
                        ClientAuthenticationMethod.CLIENT_SECRET_BASIC,
                        null,
                        null);

        assertThat(provider.authenticate(token)).isNull();
        assertThat(provider.supports(OAuth2ClientAuthenticationToken.class)).isTrue();
    }

    @Test
    void rejectsMissingOrMisconfiguredRegisteredClient() {
        OAuth2ClientAuthenticationToken token =
                new OAuth2ClientAuthenticationToken(
                        "admin-console", ClientAuthenticationMethod.NONE, null, null);
        when(repository.findByClientId("admin-console")).thenReturn(null);

        assertThatThrownBy(() -> provider.authenticate(token))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    @Test
    void authenticatesConsolePublicClient() {
        OAuth2ClientAuthenticationToken token =
                new OAuth2ClientAuthenticationToken(
                        "admin-console", ClientAuthenticationMethod.NONE, null, null);
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("admin-console")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                        .authorizationGrantType(
                                new org.springframework.security.oauth2.core.AuthorizationGrantType(
                                        "refresh_token"))
                        .build();
        when(repository.findByClientId("admin-console")).thenReturn(client);

        OAuth2ClientAuthenticationToken authenticated =
                (OAuth2ClientAuthenticationToken) provider.authenticate(token);

        assertThat(authenticated.getRegisteredClient()).isEqualTo(client);
    }
}
