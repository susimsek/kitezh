package io.github.susimsek.kitezh.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;

class RotatingClientSecretAuthenticationProviderTest {

    private final RegisteredClientRepository repository = mock(RegisteredClientRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final RotatingClientSecretAuthenticationProvider provider =
            new RotatingClientSecretAuthenticationProvider(repository, passwordEncoder);

    @Test
    void authenticatesWithPreviousSecretDuringGracePeriod() {
        RegisteredClient client = client(ClientAuthenticationMethod.CLIENT_SECRET_BASIC, false);
        when(repository.findByClientId("client")).thenReturn(client);
        when(passwordEncoder.matches("old-secret", "encoded-old-secret")).thenReturn(true);

        Authentication result =
                provider.authenticate(token(ClientAuthenticationMethod.CLIENT_SECRET_BASIC));

        assertThat(result).isInstanceOf(OAuth2ClientAuthenticationToken.class);
        assertThat(((OAuth2ClientAuthenticationToken) result).getRegisteredClient())
                .isEqualTo(client);
    }

    @Test
    void returnsNullForUnsupportedOrMissingClientData() {
        assertThat(provider.authenticate(token(ClientAuthenticationMethod.NONE))).isNull();
        when(repository.findByClientId("client")).thenReturn(null);
        assertThat(provider.authenticate(token(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)))
                .isNull();

        RegisteredClient withoutPreviousSecret =
                client(ClientAuthenticationMethod.CLIENT_SECRET_BASIC, false);
        when(repository.findByClientId("client")).thenReturn(withoutPreviousSecret);
        assertThat(provider.authenticate(token(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)))
                .isNull();
    }

    @Test
    void rejectsInvalidExpiredAndUnsupportedGracePeriodSettings() {
        RegisteredClient invalidDate = client(ClientAuthenticationMethod.CLIENT_SECRET_BASIC, true);
        when(repository.findByClientId("client")).thenReturn(invalidDate);
        when(passwordEncoder.matches("old-secret", "encoded-old-secret")).thenReturn(true);
        assertThat(provider.authenticate(token(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)))
                .isNull();

        RegisteredClient expired = client(ClientAuthenticationMethod.CLIENT_SECRET_BASIC, false);
        expired = withExpiry(expired, Instant.now().minusSeconds(60).toString());
        when(repository.findByClientId("client")).thenReturn(expired);
        assertThat(provider.authenticate(token(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)))
                .isNull();

        RegisteredClient postOnly = client(ClientAuthenticationMethod.CLIENT_SECRET_POST, false);
        when(repository.findByClientId("client")).thenReturn(postOnly);
        assertThat(provider.authenticate(token(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)))
                .isNull();
    }

    @Test
    void supportsOnlyClientAuthenticationTokens() {
        assertThat(provider.supports(OAuth2ClientAuthenticationToken.class)).isTrue();
        assertThat(provider.supports(Authentication.class)).isFalse();
    }

    private OAuth2ClientAuthenticationToken token(ClientAuthenticationMethod method) {
        return new OAuth2ClientAuthenticationToken("client", method, "old-secret", null);
    }

    private static RegisteredClient client(ClientAuthenticationMethod method, boolean invalidDate) {
        return RegisteredClient.withId("id")
                .clientId("client")
                .clientSecret("current-secret")
                .clientAuthenticationMethod(method)
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .clientSettings(
                        ClientSettings.withSettings(
                                        Map.of(
                                                ClientSecuritySettings.PREVIOUS_SECRET,
                                                "encoded-old-secret",
                                                ClientSecuritySettings.PREVIOUS_SECRET_EXPIRES_AT,
                                                invalidDate
                                                        ? "not-an-instant"
                                                        : Instant.now()
                                                                .plusSeconds(600)
                                                                .toString()))
                                .build())
                .build();
    }

    private static RegisteredClient withExpiry(RegisteredClient client, String expiry) {
        return RegisteredClient.from(client)
                .clientSettings(
                        ClientSettings.withSettings(
                                        Map.of(
                                                ClientSecuritySettings.PREVIOUS_SECRET,
                                                "encoded-old-secret",
                                                ClientSecuritySettings.PREVIOUS_SECRET_EXPIRES_AT,
                                                expiry == null
                                                        ? Instant.now().plusSeconds(600).toString()
                                                        : expiry))
                                .build())
                .build();
    }
}
