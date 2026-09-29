package io.github.susimsek.springauthserversamples.service.ciba;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;

class CibaClientAuthenticationServiceTest {

    private final RegisteredClientRepository clients = mock(RegisteredClientRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final CibaClientAuthenticationService service =
            new CibaClientAuthenticationService(clients, passwordEncoder);
    private final RegisteredClient client =
            RegisteredClient.withId("client-id")
                    .clientId("demo")
                    .clientSecret("encoded")
                    .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                    .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                    .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                    .build();

    @Test
    void authenticatesBasicAndPostClients() {
        when(clients.findByClientId("demo")).thenReturn(client);
        when(passwordEncoder.matches("secret", "encoded")).thenReturn(true);

        MockHttpServletRequest basic = new MockHttpServletRequest();
        basic.addHeader(
                "Authorization",
                "Basic "
                        + Base64.getEncoder()
                                .encodeToString("demo:secret".getBytes(StandardCharsets.UTF_8)));
        OAuth2ClientAuthenticationToken basicToken = service.authenticate(basic);
        assertThat(basicToken.getClientAuthenticationMethod())
                .isEqualTo(ClientAuthenticationMethod.CLIENT_SECRET_BASIC);

        MockHttpServletRequest post = new MockHttpServletRequest();
        post.addParameter("client_id", "demo");
        post.addParameter("client_secret", "secret");
        OAuth2ClientAuthenticationToken postToken = service.authenticate(post);
        assertThat(postToken.getClientAuthenticationMethod())
                .isEqualTo(ClientAuthenticationMethod.CLIENT_SECRET_POST);
    }

    @Test
    void rejectsMalformedMissingAndInvalidCredentials() {
        assertProtocol(new MockHttpServletRequest(), "invalid_client", HttpStatus.UNAUTHORIZED);

        MockHttpServletRequest unsupported = new MockHttpServletRequest();
        unsupported.addHeader("Authorization", "Bearer token");
        assertProtocol(unsupported, "invalid_request", HttpStatus.BAD_REQUEST);

        MockHttpServletRequest malformed = new MockHttpServletRequest();
        malformed.addHeader("Authorization", "Basic not-base64");
        assertProtocol(malformed, "invalid_request", HttpStatus.BAD_REQUEST);

        MockHttpServletRequest multiple = new MockHttpServletRequest();
        multiple.addHeader("Authorization", "Basic ZGVtbzpzZWNyZXQ=");
        multiple.addParameter("client_id", "demo");
        assertProtocol(multiple, "invalid_request", HttpStatus.BAD_REQUEST);

        when(clients.findByClientId("demo")).thenReturn(client);
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);
        MockHttpServletRequest invalidSecret = new MockHttpServletRequest();
        invalidSecret.addParameter("client_id", "demo");
        invalidSecret.addParameter("client_secret", "wrong");
        assertProtocol(invalidSecret, "invalid_client", HttpStatus.UNAUTHORIZED);
    }

    @Test
    void rejectsClientWithUnsupportedAuthenticationMethodOrMissingSecret() {
        RegisteredClient publicClient =
                RegisteredClient.withId("public-id")
                        .clientId("public")
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .build();
        when(clients.findByClientId("public")).thenReturn(publicClient);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("client_id", "public");
        request.addParameter("client_secret", "secret");
        assertProtocol(request, "invalid_client", HttpStatus.UNAUTHORIZED);
    }

    private void assertProtocol(HttpServletRequest request, String error, HttpStatus status) {
        assertThatThrownBy(() -> service.authenticate(request))
                .isInstanceOf(CibaProtocolException.class)
                .satisfies(
                        exception -> {
                            CibaProtocolException ciba = (CibaProtocolException) exception;
                            assertThat(ciba.error()).isEqualTo(error);
                            assertThat(ciba.status()).isEqualTo(status);
                        });
    }
}
