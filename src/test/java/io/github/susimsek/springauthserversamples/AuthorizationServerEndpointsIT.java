package io.github.susimsek.springauthserversamples;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.springauthserversamples.repository.UserSessionRepository;
import jakarta.servlet.http.Cookie;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsent;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsentService;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
class AuthorizationServerEndpointsIT {

    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();

    @Autowired private MockMvc mockMvc;

    @Autowired private RegisteredClientRepository registeredClientRepository;

    @Autowired private OAuth2AuthorizationConsentService authorizationConsentService;

    @Autowired private UserSessionRepository userSessionRepository;

    @Test
    void formLoginWithoutSavedRequestRedirectsToAdminConsole() throws Exception {
        mockMvc.perform(
                        post("/login")
                                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                .param("username", "admin")
                                .param("password", "admin"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/admin"));
    }

    @Test
    void publicLoginSettingsDisablePasskeysByDefault() throws Exception {
        mockMvc.perform(get("/api/auth/login-settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passkeys").value(false))
                .andExpect(jsonPath("$.webauthnMediation").value("none"));
    }

    @Test
    void registrationCaptchaIsDisabledByDefaultAndDoesNotExposeSecrets() throws Exception {
        mockMvc.perform(get("/api/auth/registration-captcha"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.siteKey").value(""))
                .andExpect(jsonPath("$.provider").value(""))
                .andExpect(jsonPath("$.secretKey").doesNotExist())
                .andExpect(jsonPath("$.apiKey").doesNotExist());
    }

    @Test
    void loginCaptchaIsDisabledByDefaultAndDoesNotExposeSecrets() throws Exception {
        mockMvc.perform(get("/api/auth/login-captcha"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.siteKey").value(""))
                .andExpect(jsonPath("$.provider").value(""))
                .andExpect(jsonPath("$.secretKey").doesNotExist())
                .andExpect(jsonPath("$.apiKey").doesNotExist());
    }

    @ParameterizedTest
    @CsvSource({"account, tr, en", "account, en, tr", "admin, tr, en", "admin, en, tr"})
    void resumedAuthorizationPreservesLocaleSelectedOnLogin(
            String console, String initialLocale, String selectedLocale) throws Exception {
        String callback = "http://localhost:9090/" + console + "/callback";
        MvcResult start =
                mockMvc.perform(
                                consoleAuthorizationRequest(
                                                console + "-console",
                                                "openid profile " + console + "-api",
                                                callback,
                                                "locale-code-verifier-012345678901234567890123456789012",
                                                "locale-state",
                                                "locale-nonce")
                                        .cookie(new Cookie("locale", initialLocale))
                                        .queryParam("ui_locales", initialLocale))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        assertThat(start.getResponse().getRedirectedUrl()).contains("/login");
        Cookie browserSession = start.getResponse().getCookie("SESSION");
        assertThat(browserSession).isNotNull();

        Cookie selection = new Cookie("locale", selectedLocale);
        MvcResult login =
                mockMvc.perform(
                                post("/login")
                                        .cookie(browserSession, selection)
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("username", "admin")
                                        .param("password", "admin"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        String savedUrl = login.getResponse().getRedirectedUrl();
        assertThat(savedUrl).contains("ui_locales=" + initialLocale);
        Cookie authenticatedSession = login.getResponse().getCookie("SESSION");
        assertThat(authenticatedSession).isNotNull();

        MvcResult resumed =
                mockMvc.perform(get(URI.create(savedUrl)).cookie(authenticatedSession, selection))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        assertThat(resumed.getResponse().getRedirectedUrl()).startsWith(callback).contains("code=");
        assertThat(resumed.getResponse().getCookie("locale")).isNull();
    }

    @Test
    void discoveryAndJwkEndpointsArePublic() throws Exception {
        mockMvc.perform(get("/.well-known/openid-configuration"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.issuer").exists())
                .andExpect(jsonPath("$.token_endpoint").exists());

        mockMvc.perform(get("/oauth2/jwks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keys").isArray());
    }

    @Test
    void tokenEndpointRejectsInvalidClientCredentials() throws Exception {
        mockMvc.perform(
                        post("/oauth2/token")
                                .with(httpBasic("demo-client", "not-the-client-secret"))
                                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                .param("grant_type", "client_credentials"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("invalid_client"));
    }

    @Test
    void openApiGroupsExposeDocumentedControllerContracts() throws Exception {
        mockMvc.perform(get("/v3/api-docs/admin-api"))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.paths['/api/admin/clients'].get.summary")
                                .value("Search clients"))
                .andExpect(
                        jsonPath("$.paths['/api/admin/clients'].get.security[0].adminBearer")
                                .exists());

        mockMvc.perform(get("/v3/api-docs/account-api"))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.paths['/api/account/profile'].get.summary")
                                .value("Read profile"))
                .andExpect(
                        jsonPath("$.paths['/api/account/profile'].get.security[0].accountBearer")
                                .exists());

        mockMvc.perform(get("/v3/api-docs/oauth2-oidc"))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.paths['/oauth2/token'].post.summary").value("Token Endpoint"))
                .andExpect(
                        jsonPath("$.paths['/oidc/session-status'].get.summary")
                                .value("Get browser SSO session status"));
    }

    @Test
    void clientCredentialsTokenCanBeIntrospectedAndRevoked() throws Exception {
        String accessToken =
                tokenRequest(
                                "demo-client",
                                "demo-secret",
                                Map.of("grant_type", "client_credentials"))
                        .get("access_token")
                        .asText();

        assertThat(accessToken).isNotBlank();

        mockMvc.perform(
                        post("/oauth2/introspect")
                                .with(httpBasic("demo-client", "demo-secret"))
                                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                .param("token", accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));

        mockMvc.perform(
                        post("/oauth2/revoke")
                                .with(httpBasic("demo-client", "demo-secret"))
                                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                .param("token", accessToken))
                .andExpect(status().isOk());

        mockMvc.perform(
                        post("/oauth2/introspect")
                                .with(httpBasic("demo-client", "demo-secret"))
                                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                .param("token", accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void consentApiSeparatesPreviouslyApprovedScopes() throws Exception {
        RegisteredClient client = registeredClientRepository.findByClientId("pkce-client");
        assertThat(client).isNotNull();

        OAuth2AuthorizationConsent existingConsent =
                OAuth2AuthorizationConsent.withId(client.getId(), "admin").scope("profile").build();
        authorizationConsentService.save(existingConsent);

        try {
            mockMvc.perform(
                            get("/api/authorization/consent")
                                    .with(user("admin").roles("ADMIN"))
                                    .queryParam("client_id", "pkce-client")
                                    .queryParam("scope", "openid profile")
                                    .queryParam("state", "consent-state"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.scopes").isEmpty())
                    .andExpect(jsonPath("$.previouslyApprovedScopes[0]").value("profile"));
        } finally {
            authorizationConsentService.remove(existingConsent);
        }
    }

    @Test
    void authorizationCodePkceRequestRedirectsToConsent() throws Exception {
        String codeVerifier = "integration-test-code-verifier-012345678901234567890123456789";
        String redirectUri = "http://127.0.0.1:8082/callback";

        MvcResult result =
                mockMvc.perform(
                                get("/oauth2/authorize")
                                        .with(user("admin").roles("ADMIN"))
                                        .accept(MediaType.TEXT_HTML)
                                        .queryParam("response_type", "code")
                                        .queryParam("client_id", "pkce-client")
                                        .queryParam("scope", "openid profile")
                                        .queryParam("redirect_uri", redirectUri)
                                        .queryParam("code_challenge", codeChallenge(codeVerifier))
                                        .queryParam("code_challenge_method", "S256")
                                        .queryParam("state", "integration-state"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();

        URI consentUri = URI.create(result.getResponse().getRedirectedUrl());
        assertThat(consentUri.getPath()).isEqualTo("/consent");

        Map<String, String> consentParameters =
                UriComponentsBuilder.fromUri(consentUri)
                        .build()
                        .getQueryParams()
                        .toSingleValueMap();

        assertThat(consentParameters).containsEntry("client_id", "pkce-client");
        assertThat(consentParameters.get("scope")).contains("openid", "profile");
        assertThat(consentParameters.get("state")).isNotBlank();
    }

    @Test
    void adminConsoleUsesPkceWithoutConsent() throws Exception {
        MvcResult loginResult =
                mockMvc.perform(
                                post("/login")
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("username", "admin")
                                        .param("password", "admin"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        var sessionCookie = loginResult.getResponse().getCookie("SESSION");
        assertThat(sessionCookie).isNotNull();

        String codeVerifier = "admin-console-code-verifier-0123456789012345678901234567890";
        String redirectUri = "http://localhost:9090/admin/callback";

        MvcResult result =
                mockMvc.perform(
                                get("/oauth2/authorize")
                                        .cookie(sessionCookie)
                                        .accept(MediaType.TEXT_HTML)
                                        .queryParam("response_type", "code")
                                        .queryParam("client_id", "admin-console")
                                        .queryParam("scope", "openid profile admin-api")
                                        .queryParam("redirect_uri", redirectUri)
                                        .queryParam("code_challenge", codeChallenge(codeVerifier))
                                        .queryParam("code_challenge_method", "S256")
                                        .queryParam("state", "admin-console-state")
                                        .queryParam("nonce", "admin-console-nonce"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();

        URI callbackUri = URI.create(result.getResponse().getRedirectedUrl());
        assertThat(callbackUri.getPath()).isEqualTo("/admin/callback");
        assertThat(callbackUri.getQuery()).contains("code=");
        assertThat(callbackUri.getQuery()).contains("state=admin-console-state");

        String authorizationCode =
                UriComponentsBuilder.fromUri(callbackUri).build().getQueryParams().getFirst("code");
        MvcResult tokenResult =
                mockMvc.perform(
                                post("/oauth2/token")
                                        .cookie(sessionCookie)
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("client_id", "admin-console")
                                        .param("code", authorizationCode)
                                        .param("code_verifier", codeVerifier)
                                        .param("grant_type", "authorization_code")
                                        .param("redirect_uri", redirectUri))
                        .andExpect(status().isOk())
                        .andReturn();

        JsonNode tokenResponse =
                JSON_MAPPER.readTree(tokenResult.getResponse().getContentAsString());
        String accessToken = tokenResponse.get("access_token").asText();
        String refreshToken = tokenResponse.get("refresh_token").asText();
        String idToken = tokenResponse.get("id_token").asText();
        assertThat(refreshToken).isNotBlank();
        assertThat(idToken).isNotBlank();
        assertThat(jwtClaims(idToken).get("nonce").asText()).isEqualTo("admin-console-nonce");
        assertThat(jwtClaims(accessToken).get("picture").asText())
                .matches("http://127\\.0\\.0\\.1:\\d+/avatars/[a-f0-9-]{36}\\?v=\\d+");
        mockMvc.perform(get("/api/admin/whoami").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.access.manageClients").value(true));

        mockMvc.perform(get("/oidc/session-status").cookie(sessionCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true));

        String accountCodeVerifier = "account-console-code-verifier-012345678901234567890123456789";
        MvcResult accountAuthorizationResult =
                mockMvc.perform(
                                get("/oauth2/authorize")
                                        .cookie(sessionCookie)
                                        .accept(MediaType.TEXT_HTML)
                                        .queryParam("response_type", "code")
                                        .queryParam("client_id", "account-console")
                                        .queryParam("scope", "openid profile account-api")
                                        .queryParam(
                                                "redirect_uri",
                                                "http://localhost:9090/account/callback")
                                        .queryParam(
                                                "code_challenge",
                                                codeChallenge(accountCodeVerifier))
                                        .queryParam("code_challenge_method", "S256")
                                        .queryParam("state", "account-console-state"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();

        URI accountCallbackUri =
                URI.create(accountAuthorizationResult.getResponse().getRedirectedUrl());
        assertThat(accountCallbackUri.getPath()).isEqualTo("/account/callback");
        assertThat(accountCallbackUri.getQuery())
                .contains("code=", "state=account-console-state")
                .doesNotContain("error=");

        MvcResult refreshResult =
                mockMvc.perform(
                                post("/oauth2/token")
                                        .cookie(sessionCookie)
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("client_id", "admin-console")
                                        .param("grant_type", "refresh_token")
                                        .param("refresh_token", refreshToken))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.access_token").isNotEmpty())
                        .andExpect(jsonPath("$.refresh_token").isNotEmpty())
                        .andExpect(jsonPath("$.id_token").isNotEmpty())
                        .andReturn();

        String rotatedRefreshToken =
                JSON_MAPPER
                        .readTree(refreshResult.getResponse().getContentAsString())
                        .get("refresh_token")
                        .asText();
        mockMvc.perform(
                        post("/oauth2/revoke")
                                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                .param("client_id", "admin-console")
                                .param("token", rotatedRefreshToken)
                                .param("token_type_hint", "refresh_token"))
                .andExpect(status().isOk());

        mockMvc.perform(
                        post("/oauth2/token")
                                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                .param("client_id", "admin-console")
                                .param("grant_type", "refresh_token")
                                .param("refresh_token", rotatedRefreshToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(
                        post("/oauth2/token")
                                .cookie(sessionCookie)
                                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                .param("client_id", "admin-console")
                                .param("code", authorizationCode)
                                .param("code_verifier", codeVerifier)
                                .param("grant_type", "authorization_code")
                                .param("redirect_uri", redirectUri))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_grant"));
    }

    @Test
    void accountConsoleReusesTheAdminBrowserSession() throws Exception {
        MvcResult loginResult =
                mockMvc.perform(
                                post("/login")
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("username", "admin")
                                        .param("password", "admin"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        var sessionCookie = loginResult.getResponse().getCookie("SESSION");
        assertThat(sessionCookie).isNotNull();

        String codeVerifier = "account-console-code-verifier-012345678901234567890123456789";
        MvcResult result =
                mockMvc.perform(
                                get("/oauth2/authorize")
                                        .cookie(sessionCookie)
                                        .accept(MediaType.TEXT_HTML)
                                        .queryParam("response_type", "code")
                                        .queryParam("client_id", "account-console")
                                        .queryParam("scope", "openid profile account-api")
                                        .queryParam(
                                                "redirect_uri",
                                                "http://localhost:9090/account/callback")
                                        .queryParam("code_challenge", codeChallenge(codeVerifier))
                                        .queryParam("code_challenge_method", "S256")
                                        .queryParam("nonce", "account-console-nonce")
                                        .queryParam("prompt", "none")
                                        .queryParam("state", "account-console-state"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();

        URI callbackUri = URI.create(result.getResponse().getRedirectedUrl());
        assertThat(callbackUri.getPath()).isEqualTo("/account/callback");
        assertThat(callbackUri.getQuery())
                .contains("code=", "state=account-console-state")
                .doesNotContain("error=");
    }

    @Test
    void adminConsoleOidcLogoutUsesIdTokenHint() throws Exception {
        MvcResult loginResult =
                mockMvc.perform(
                                post("/login")
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("username", "admin")
                                        .param("password", "admin"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        var sessionCookie = loginResult.getResponse().getCookie("SESSION");
        assertThat(sessionCookie).isNotNull();

        String codeVerifier = "admin-console-logout-verifier-012345678901234567890123456789012";
        String redirectUri = "http://localhost:9090/admin/callback";
        MvcResult authorizeResult =
                mockMvc.perform(
                                get("/oauth2/authorize")
                                        .cookie(sessionCookie)
                                        .queryParam("response_type", "code")
                                        .queryParam("client_id", "admin-console")
                                        .queryParam("scope", "openid profile admin-api")
                                        .queryParam("redirect_uri", redirectUri)
                                        .queryParam("code_challenge", codeChallenge(codeVerifier))
                                        .queryParam("code_challenge_method", "S256")
                                        .queryParam("state", "logout-state")
                                        .queryParam("nonce", "logout-nonce"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        URI callbackUri = URI.create(authorizeResult.getResponse().getRedirectedUrl());
        String authorizationCode =
                UriComponentsBuilder.fromUri(callbackUri).build().getQueryParams().getFirst("code");
        MvcResult tokenResult =
                mockMvc.perform(
                                post("/oauth2/token")
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("client_id", "admin-console")
                                        .param("code", authorizationCode)
                                        .param("code_verifier", codeVerifier)
                                        .param("grant_type", "authorization_code")
                                        .param("redirect_uri", redirectUri))
                        .andExpect(status().isOk())
                        .andReturn();
        String idToken =
                JSON_MAPPER
                        .readTree(tokenResult.getResponse().getContentAsString())
                        .get("id_token")
                        .asText();

        mockMvc.perform(
                        get("/connect/logout")
                                .cookie(sessionCookie)
                                .queryParam("client_id", "admin-console")
                                .queryParam("id_token_hint", idToken)
                                .queryParam(
                                        "post_logout_redirect_uri", "http://localhost:9090/admin/"))
                .andExpect(status().is3xxRedirection())
                .andExpect(
                        logoutResult ->
                                assertThat(logoutResult.getResponse().getRedirectedUrl())
                                        .isEqualTo("http://localhost:9090/admin/"));
    }

    @Test
    void adminConsoleSilentAuthorizationReusesAuthenticatedSession() throws Exception {
        MvcResult loginResult =
                mockMvc.perform(
                                post("/login")
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("username", "admin")
                                        .param("password", "admin"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        var sessionCookie = loginResult.getResponse().getCookie("SESSION");
        assertThat(sessionCookie).isNotNull();

        String codeVerifier = "admin-console-silent-code-verifier-0123456789012345678901234567890";
        String redirectUri = "http://localhost:9090/admin/callback";

        MvcResult result =
                mockMvc.perform(
                                get("/oauth2/authorize")
                                        .cookie(sessionCookie)
                                        .accept(MediaType.TEXT_HTML)
                                        .queryParam("response_type", "code")
                                        .queryParam("client_id", "admin-console")
                                        .queryParam("scope", "openid profile admin-api")
                                        .queryParam("redirect_uri", redirectUri)
                                        .queryParam("code_challenge", codeChallenge(codeVerifier))
                                        .queryParam("code_challenge_method", "S256")
                                        .queryParam("prompt", "none")
                                        .queryParam("state", "reload-state")
                                        .queryParam("nonce", "reload-nonce"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();

        URI callbackUri = URI.create(result.getResponse().getRedirectedUrl());
        assertThat(callbackUri.getPath()).isEqualTo("/admin/callback");
        assertThat(callbackUri.getQuery()).contains("code=");
        assertThat(callbackUri.getQuery()).contains("state=reload-state");
    }

    @Test
    void adminAndAccountConsolesReuseTheSameSsoSession() throws Exception {
        MvcResult loginResult =
                mockMvc.perform(
                                post("/login")
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("username", "admin")
                                        .param("password", "admin"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        var sessionCookie = loginResult.getResponse().getCookie("SESSION");
        assertThat(sessionCookie).isNotNull();

        assertConsoleAuthorizationRedirectsWithoutLogin(
                sessionCookie,
                "admin-console",
                "openid profile admin-api",
                "http://localhost:9090/admin/callback",
                "shared-sso-admin-state",
                "shared-sso-admin-nonce",
                "shared-sso-admin-verifier-012345678901234567890123456789012");
        assertConsoleAuthorizationRedirectsWithoutLogin(
                sessionCookie,
                "account-console",
                "openid profile account-api",
                "http://localhost:9090/account/callback",
                "shared-sso-account-state",
                "shared-sso-account-nonce",
                "shared-sso-account-verifier-0123456789012345678901234567890");
    }

    @Test
    void consoleLoginKeepsOneBrowserSessionAcrossAdminAndAccountAuthorization() throws Exception {
        long sessionsBeforeLogin = activeSessionCount("admin");
        String adminVerifier = "browser-admin-verifier-0123456789012345678901234567890123456789";

        MvcResult unauthenticatedAuthorization =
                mockMvc.perform(
                                consoleAuthorizationRequest(
                                        "admin-console",
                                        "openid profile admin-api",
                                        "http://localhost:9090/admin/callback",
                                        adminVerifier,
                                        "browser-admin-state",
                                        "browser-admin-nonce"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        var preLoginSession = unauthenticatedAuthorization.getResponse().getCookie("SESSION");
        assertThat(preLoginSession).isNotNull();
        assertThat(unauthenticatedAuthorization.getResponse().getRedirectedUrl())
                .contains("/login");

        MvcResult loginResult =
                mockMvc.perform(
                                post("/login")
                                        .cookie(preLoginSession)
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("username", "admin")
                                        .param("password", "admin"))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        var authenticatedSession = loginResult.getResponse().getCookie("SESSION");
        assertThat(authenticatedSession).isNotNull();
        assertThat(authenticatedSession.getValue()).isNotEqualTo(preLoginSession.getValue());
        assertThat(activeSessionCount("admin")).isEqualTo(sessionsBeforeLogin + 1);

        MvcResult adminAuthorization =
                mockMvc.perform(
                                consoleAuthorizationRequest(
                                                "admin-console",
                                                "openid profile admin-api",
                                                "http://localhost:9090/admin/callback",
                                                adminVerifier,
                                                "browser-admin-state",
                                                "browser-admin-nonce")
                                        .cookie(authenticatedSession))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        URI adminCallback = URI.create(adminAuthorization.getResponse().getRedirectedUrl());
        assertThat(adminCallback.getPath()).isEqualTo("/admin/callback");
        String adminCode =
                UriComponentsBuilder.fromUri(adminCallback)
                        .build()
                        .getQueryParams()
                        .getFirst("code");
        MvcResult adminTokenResult =
                mockMvc.perform(
                                post("/oauth2/token")
                                        .cookie(authenticatedSession)
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("client_id", "admin-console")
                                        .param("grant_type", "authorization_code")
                                        .param("code", adminCode)
                                        .param("code_verifier", adminVerifier)
                                        .param(
                                                "redirect_uri",
                                                "http://localhost:9090/admin/callback"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.refresh_token").isNotEmpty())
                        .andReturn();
        String adminRefreshToken =
                JSON_MAPPER
                        .readTree(adminTokenResult.getResponse().getContentAsString())
                        .get("refresh_token")
                        .asText();
        String adminAccessToken =
                JSON_MAPPER
                        .readTree(adminTokenResult.getResponse().getContentAsString())
                        .get("access_token")
                        .asText();
        assertThat(adminTokenResult.getResponse().getCookie("SESSION")).isNull();
        assertThat(activeSessionCount("admin")).isEqualTo(sessionsBeforeLogin + 1);

        MvcResult adminApiResult =
                mockMvc.perform(
                                get("/api/admin/dashboard")
                                        .cookie(authenticatedSession)
                                        .header(
                                                HttpHeaders.AUTHORIZATION,
                                                "Bearer " + adminAccessToken))
                        .andExpect(status().isOk())
                        .andReturn();
        assertThat(adminApiResult.getResponse().getCookie("SESSION")).isNull();

        String accountVerifier =
                "browser-account-verifier-0123456789012345678901234567890123456789";
        MvcResult accountAuthorization =
                mockMvc.perform(
                                consoleAuthorizationRequest(
                                                "account-console",
                                                "openid profile account-api",
                                                "http://localhost:9090/account/callback",
                                                accountVerifier,
                                                "browser-account-state",
                                                "browser-account-nonce")
                                        .cookie(authenticatedSession))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();
        URI accountCallback = URI.create(accountAuthorization.getResponse().getRedirectedUrl());
        assertThat(accountCallback.getPath()).isEqualTo("/account/callback");
        String accountCode =
                UriComponentsBuilder.fromUri(accountCallback)
                        .build()
                        .getQueryParams()
                        .getFirst("code");
        MvcResult accountTokenResult =
                mockMvc.perform(
                                post("/oauth2/token")
                                        .cookie(authenticatedSession)
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("client_id", "account-console")
                                        .param("grant_type", "authorization_code")
                                        .param("code", accountCode)
                                        .param("code_verifier", accountVerifier)
                                        .param(
                                                "redirect_uri",
                                                "http://localhost:9090/account/callback"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.refresh_token").isNotEmpty())
                        .andReturn();
        String accountRefreshToken =
                JSON_MAPPER
                        .readTree(accountTokenResult.getResponse().getContentAsString())
                        .get("refresh_token")
                        .asText();
        String accountAccessToken =
                JSON_MAPPER
                        .readTree(accountTokenResult.getResponse().getContentAsString())
                        .get("access_token")
                        .asText();
        assertThat(accountTokenResult.getResponse().getCookie("SESSION")).isNull();
        assertThat(accountRefreshToken).isNotEqualTo(adminRefreshToken);

        MvcResult accountApiResult =
                mockMvc.perform(
                                get("/api/account/profile")
                                        .cookie(authenticatedSession)
                                        .header(
                                                HttpHeaders.AUTHORIZATION,
                                                "Bearer " + accountAccessToken))
                        .andExpect(status().isOk())
                        .andReturn();
        assertThat(accountApiResult.getResponse().getCookie("SESSION")).isNull();
        mockMvc.perform(get("/oidc/session-status").cookie(authenticatedSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true));
        assertThat(activeSessionCount("admin")).isEqualTo(sessionsBeforeLogin + 1);
    }

    private long activeSessionCount(String username) {
        return userSessionRepository
                .findAllByPrincipalNameAndExpiryTimeAfter(username, System.currentTimeMillis())
                .size();
    }

    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
            consoleAuthorizationRequest(
                    String clientId,
                    String scope,
                    String redirectUri,
                    String codeVerifier,
                    String state,
                    String nonce)
                    throws NoSuchAlgorithmException {
        return get("/oauth2/authorize")
                .accept(MediaType.TEXT_HTML)
                .queryParam("response_type", "code")
                .queryParam("client_id", clientId)
                .queryParam("scope", scope)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("code_challenge", codeChallenge(codeVerifier))
                .queryParam("code_challenge_method", "S256")
                .queryParam("state", state)
                .queryParam("nonce", nonce);
    }

    private void assertConsoleAuthorizationRedirectsWithoutLogin(
            jakarta.servlet.http.Cookie sessionCookie,
            String clientId,
            String scope,
            String redirectUri,
            String state,
            String nonce,
            String codeVerifier)
            throws Exception {
        MvcResult result =
                mockMvc.perform(
                                get("/oauth2/authorize")
                                        .cookie(sessionCookie)
                                        .accept(MediaType.TEXT_HTML)
                                        .queryParam("response_type", "code")
                                        .queryParam("client_id", clientId)
                                        .queryParam("scope", scope)
                                        .queryParam("redirect_uri", redirectUri)
                                        .queryParam("code_challenge", codeChallenge(codeVerifier))
                                        .queryParam("code_challenge_method", "S256")
                                        .queryParam("state", state)
                                        .queryParam("nonce", nonce))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();

        URI callbackUri = URI.create(result.getResponse().getRedirectedUrl());
        assertThat(callbackUri.toString()).startsWith(redirectUri);
        assertThat(callbackUri.getQuery()).contains("code=");
        assertThat(callbackUri.getQuery()).contains("state=" + state);
    }

    private JsonNode tokenRequest(String clientId, String clientSecret, Map<String, String> form)
            throws Exception {
        var request =
                post("/oauth2/token")
                        .with(httpBasic(clientId, clientSecret))
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED);

        form.forEach(request::param);

        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return JSON_MAPPER.readTree(result.getResponse().getContentAsString());
    }

    private static String codeChallenge(String codeVerifier) throws NoSuchAlgorithmException {
        byte[] digest =
                MessageDigest.getInstance("SHA-256")
                        .digest(codeVerifier.getBytes(StandardCharsets.US_ASCII));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }

    private static JsonNode jwtClaims(String token) throws Exception {
        String encodedClaims = token.split("\\.")[1];
        return JSON_MAPPER.readTree(Base64.getUrlDecoder().decode(encodedClaims));
    }
}
