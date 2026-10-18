package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpSession;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;

@ExtendWith(MockitoExtension.class)
class MobileSocialLoginTransactionServiceTest {

    private static final String CALLBACK = "kitezh://oauth/callback";
    private static final String STATE = "abcdefghijklmnopqrstuvwxyz012345";
    private static final String CHALLENGE =
            "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHijklmnoPQR";

    @Mock private RegisteredClientRepository clients;

    @Mock private SocialLoginService socialLoginService;

    private MobileSocialLoginTransactionService service;

    @BeforeEach
    void setUp() {
        service = new MobileSocialLoginTransactionService(clients, socialLoginService);
    }

    @Test
    void beginsOneTimeTransactionForConfiguredProviderAndRegisteredPkceClient() {
        when(socialLoginService.mobileLoginRegistrationId("google"))
                .thenReturn("google-registration");
        when(clients.findByClientId("mobile-account-console")).thenReturn(mobileClient());
        HttpSession session = new MockHttpSession();

        String destination = service.begin("google", authorizationParameters(), session);

        assertThat(destination).isEqualTo("/oauth2/authorization/google-registration");
        assertThat(service.peek(session))
                .contains("/oauth2/authorize?response_type=code")
                .contains("client_id=mobile-account-console")
                .contains("code_challenge=" + CHALLENGE)
                .contains("code_challenge_method=S256")
                .contains("state=" + STATE);
        assertThat(service.consume(session)).isNotNull();
        assertThat(service.consume(session)).isNull();
    }

    @Test
    void rejectsUnregisteredRedirectUriBeforeWritingTransaction() {
        when(socialLoginService.mobileLoginRegistrationId("google")).thenReturn("google");
        when(clients.findByClientId("mobile-account-console")).thenReturn(mobileClient());
        HttpSession session = new MockHttpSession();
        Map<String, String> parameters = new java.util.HashMap<>(authorizationParameters());
        parameters.put("redirect_uri", "https://attacker.example/callback");

        assertThatIllegalArgumentException()
                .isThrownBy(() -> service.begin("google", parameters, session));
        assertThat(service.peek(session)).isNull();
    }

    @Test
    void rejectsUnconfiguredProviderBeforeStartingBrowserAuthorization() {
        HttpSession session = new MockHttpSession();

        assertThatIllegalArgumentException()
                .isThrownBy(() -> service.begin("google", authorizationParameters(), session));
        assertThat(service.peek(session)).isNull();
    }

    @Test
    void consumesProviderFailureIntoTheRegisteredCallbackWithOriginalState() {
        when(socialLoginService.mobileLoginRegistrationId("google")).thenReturn("google");
        when(clients.findByClientId("mobile-account-console")).thenReturn(mobileClient());
        HttpSession session = new MockHttpSession();
        service.begin("google", authorizationParameters(), session);

        String callback = service.failureRedirect(session);

        assertThat(callback)
                .startsWith(CALLBACK)
                .contains("error=access_denied")
                .contains("state=" + STATE);
        assertThat(service.failureRedirect(session)).isNull();
    }

    private static Map<String, String> authorizationParameters() {
        return Map.of(
                "response_type", "code",
                "client_id", "mobile-account-console",
                "redirect_uri", CALLBACK,
                "scope", "openid account-api",
                "state", STATE,
                "code_challenge", CHALLENGE,
                "code_challenge_method", "S256",
                "ui_locales", "en");
    }

    private static RegisteredClient mobileClient() {
        return RegisteredClient.withId("mobile-account-console")
                .clientId("mobile-account-console")
                .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(CALLBACK)
                .scope("openid")
                .scope("account-api")
                .clientSettings(ClientSettings.builder().requireProofKey(true).build())
                .build();
    }
}
