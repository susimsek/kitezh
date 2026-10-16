package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService;
import io.github.susimsek.kitezh.session.JpaIndexedSessionRepository;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
class SocialLoginLogoutIT {

    private static final String CALLBACK = "kitezh://oauth/callback";
    private static final String LOGOUT_CALLBACK = "kitezh://logout/callback";
    private static final String GOOGLE = "google";

    @Autowired private MockMvc mockMvc;

    @Autowired private JpaIndexedSessionRepository sessions;

    @MockitoBean private SocialProviderSettingsService providerSettings;

    @ParameterizedTest
    @CsvSource({
        "google, account, en",
        "google, account, tr",
        "google, admin, en",
        "google, admin, tr",
        "github, account, en",
        "github, account, tr",
        "github, admin, en",
        "github, admin, tr"
    })
    void socialLogoutReturnsToRegisteredDesktopCallbackAndInvalidatesSession(
            String provider, String console, String locale) throws Exception {
        Login login = login(console, provider);
        mockMvc.perform(
                        get("/connect/logout")
                                .cookie(login.cookie())
                                .header("Accept-Language", locale)
                                .queryParam("client_id", "desktop-" + console + "-console")
                                .queryParam("id_token_hint", login.idToken())
                                .queryParam("post_logout_redirect_uri", LOGOUT_CALLBACK))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl(LOGOUT_CALLBACK));

        assertThat(sessions.findById(login.sessionId())).isNull();
        mockMvc.perform(
                        get("/oauth2/authorize")
                                .cookie(login.cookie())
                                .accept(MediaType.TEXT_HTML)
                                .queryParam("response_type", "code")
                                .queryParam("client_id", "desktop-" + console + "-console")
                                .queryParam("scope", "openid profile " + console + "-api")
                                .queryParam("redirect_uri", CALLBACK)
                                .queryParam("code_challenge", challenge("test-verifier"))
                                .queryParam("code_challenge_method", "S256")
                                .queryParam("prompt", "none"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/login"));
    }

    @ParameterizedTest
    @CsvSource({"account, en", "account, tr", "admin, en", "admin, tr"})
    void rejectsUnregisteredLogoutCallbackWithoutEndingSession(String console, String locale)
            throws Exception {
        Login login = login(console, GOOGLE);
        mockMvc.perform(
                        get("/connect/logout")
                                .cookie(login.cookie())
                                .header("Accept-Language", locale)
                                .queryParam("client_id", "desktop-" + console + "-console")
                                .queryParam("id_token_hint", login.idToken())
                                .queryParam(
                                        "post_logout_redirect_uri", "kitezh://logout/unregistered"))
                .andExpect(status().isBadRequest());
        assertThat(sessions.findById(login.sessionId())).isNotNull();
    }

    private Login login(String console, String provider) throws Exception {
        when(providerSettings.provider(provider))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                provider, "test-client", "test-secret"));
        var result =
                mockMvc.perform(
                                post("/login")
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("username", "admin")
                                        .param("password", "admin"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        Cookie cookie = result.getResponse().getCookie("SESSION");
        assertThat(cookie).isNotNull();
        String sessionId =
                new String(Base64.getDecoder().decode(cookie.getValue()), StandardCharsets.UTF_8);
        var session = sessions.findById(sessionId);
        assertThat(session).isNotNull();
        // Model the verified broker marker; real provider credentials/network are not used here.
        session.setAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER, provider);
        sessions.save(session);
        String verifier = "desktop-google-logout-verifier-0123456789012345678901234567890";
        var authorization =
                mockMvc.perform(
                                get("/oauth2/authorize")
                                        .cookie(cookie)
                                        .queryParam("response_type", "code")
                                        .queryParam("client_id", "desktop-" + console + "-console")
                                        .queryParam("scope", "openid profile " + console + "-api")
                                        .queryParam("redirect_uri", CALLBACK)
                                        .queryParam("code_challenge", challenge(verifier))
                                        .queryParam("code_challenge_method", "S256"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        String code =
                UriComponentsBuilder.fromUriString(authorization.getResponse().getRedirectedUrl())
                        .build()
                        .getQueryParams()
                        .getFirst("code");
        assertThat(code).isNotBlank();
        var tokens =
                mockMvc.perform(
                                post("/oauth2/token")
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("client_id", "desktop-" + console + "-console")
                                        .param("code", code)
                                        .param("code_verifier", verifier)
                                        .param("grant_type", "authorization_code")
                                        .param("redirect_uri", CALLBACK))
                        .andExpect(status().isOk())
                        .andReturn();
        String idToken =
                JsonMapper.builder()
                        .build()
                        .readTree(tokens.getResponse().getContentAsString())
                        .get("id_token")
                        .asText();
        return new Login(cookie, sessionId, idToken);
    }

    private static String challenge(String verifier) throws Exception {
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(
                        MessageDigest.getInstance("SHA-256")
                                .digest(verifier.getBytes(StandardCharsets.US_ASCII)));
    }

    private record Login(Cookie cookie, String sessionId, String idToken) {}
}
