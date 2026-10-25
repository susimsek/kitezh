package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
class MobileNativeLoginIT {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String CLIENT_ID = "mobile-account-console";
    private static final String REDIRECT_URI = "kitezh://oauth/callback";
    private static final String CODE_VERIFIER =
            "native-login-test-verifier-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final String STATE = "state_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final String NONCE = "nonce_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    @Autowired private MockMvc mockMvc;

    @Test
    void issuesAuthorizationCodeThatExchangesThroughSasWithS256Verifier() throws Exception {
        String code = beginLogin(REDIRECT_URI, codeChallenge(CODE_VERIFIER));

        MvcResult tokenResult =
                mockMvc.perform(
                                post("/oauth2/token")
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .param("grant_type", "authorization_code")
                                        .param("client_id", CLIENT_ID)
                                        .param("redirect_uri", REDIRECT_URI)
                                        .param("code", code)
                                        .param("code_verifier", CODE_VERIFIER))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.access_token").isNotEmpty())
                        .andExpect(jsonPath("$.id_token").isNotEmpty())
                        .andReturn();

        assertThat(tokenResult.getResponse().getContentAsString()).contains("access_token");
        mockMvc.perform(
                        post("/oauth2/token")
                                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                .param("grant_type", "authorization_code")
                                .param("client_id", CLIENT_ID)
                                .param("redirect_uri", REDIRECT_URI)
                                .param("code", code)
                                .param("code_verifier", CODE_VERIFIER))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_grant"));
    }

    @Test
    void rejectsUnregisteredRedirectAndInvalidPkceChallengeBeforePasswordAuthentication()
            throws Exception {
        mockMvc.perform(
                        post("/api/auth/mobile/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        request(
                                                "https://attacker.example/callback",
                                                codeChallenge(CODE_VERIFIER))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(
                        post("/api/auth/mobile/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(request(REDIRECT_URI, "not-a-valid-s256-challenge")))
                .andExpect(status().isBadRequest());
    }

    private String beginLogin(String redirectUri, String challenge) throws Exception {
        MvcResult result =
                mockMvc.perform(
                                post("/api/auth/mobile/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(request(redirectUri, challenge)))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.status").value("authorized"))
                        .andExpect(jsonPath("$.state").value(STATE))
                        .andExpect(jsonPath("$.redirectUri").value(redirectUri))
                        .andExpect(jsonPath("$.transactionId").doesNotExist())
                        .andReturn();
        return JSON.readTree(result.getResponse().getContentAsString()).get("code").asText();
    }

    private static String request(String redirectUri, String challenge) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("clientId", CLIENT_ID);
        body.put("redirectUri", redirectUri);
        body.put("scope", "openid profile email account-api");
        body.put("state", STATE);
        body.put("codeChallenge", challenge);
        body.put("codeChallengeMethod", "S256");
        body.put("nonce", NONCE);
        body.put("platform", "ANDROID");
        body.put("username", "admin");
        body.put("password", "admin");
        return JSON.writeValueAsString(body);
    }

    private static String codeChallenge(String verifier) throws Exception {
        byte[] digest =
                MessageDigest.getInstance("SHA-256")
                        .digest(verifier.getBytes(StandardCharsets.US_ASCII));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }
}
