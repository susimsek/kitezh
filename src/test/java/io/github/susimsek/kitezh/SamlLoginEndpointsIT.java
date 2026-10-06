package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
@TestPropertySource(
        properties = "app.social-login.encryption-key=integration-test-social-login-key")
class SamlLoginEndpointsIT {

    private static final String PROVIDERS = "/api/admin/identity-providers";
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Autowired private MockMvc mockMvc;

    @Test
    void publishesCorrectMetadataAndRefreshesRegistrationAfterCommittedUpdate() throws Exception {
        String alias = "saml-it-" + UUID.randomUUID();
        Map<String, Object> settings = settings(alias);
        String id = createProvider(settings);
        try {
            String metadata = metadata(alias);
            assertThat(metadata)
                    .contains("http://localhost/login/saml2/sso/" + alias)
                    .contains("http://localhost/logout/saml2/slo/" + alias)
                    .doesNotContain("Location=\"https://idp.example.test/slo\"");

            settings.put("samlServiceProviderEntityId", "https://sp.example.test/updated");
            mockMvc.perform(
                            put(PROVIDERS + "/{id}", id)
                                    .with(admin())
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(JSON.writeValueAsString(settings)))
                    .andExpect(status().isOk());

            assertThat(metadata(alias)).contains("entityID=\"https://sp.example.test/updated\"");
        } finally {
            mockMvc.perform(delete(PROVIDERS + "/{id}", id).with(admin()))
                    .andExpect(status().isNoContent());
        }
    }

    @Test
    void rejectsMalformedAcsPostWithoutCreatingAuthenticatedBrowserSession() throws Exception {
        String alias = "saml-it-" + UUID.randomUUID();
        String id = createProvider(settings(alias));
        try {
            Cookie session =
                    mockMvc.perform(get("/saml2/authenticate/{alias}", alias))
                            .andExpect(status().isFound())
                            .andReturn()
                            .getResponse()
                            .getCookie("SESSION");
            assertThat(session).isNotNull();

            mockMvc.perform(
                            post("/login/saml2/sso/{alias}", alias)
                                    .cookie(session)
                                    .header("Origin", "https://idp.example.test")
                                    .header("Sec-Fetch-Mode", "navigate")
                                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                    .param("SAMLResponse", "not-a-signed-saml-response"))
                    .andExpect(status().isFound())
                    .andExpect(redirectedUrl("/login?error"));
            mockMvc.perform(get("/oidc/session-status").cookie(session))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("unauthorized"));
            mockMvc.perform(
                            post("/login/saml2/sso/{alias}", alias)
                                    .header("Origin", "https://idp.example.test")
                                    .header("Sec-Fetch-Mode", "cors")
                                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                    .param("SAMLResponse", "not-a-signed-saml-response"))
                    .andExpect(status().isForbidden());
            mockMvc.perform(
                            get("/api/account/profile")
                                    .header("Origin", "https://idp.example.test"))
                    .andExpect(status().isForbidden());
        } finally {
            mockMvc.perform(delete(PROVIDERS + "/{id}", id).with(admin()))
                    .andExpect(status().isNoContent());
        }
    }

    private String createProvider(Map<String, Object> settings) throws Exception {
        String response =
                mockMvc.perform(
                                post(PROVIDERS)
                                        .with(admin())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(JSON.writeValueAsString(settings)))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        return JSON.readTree(response).get("id").asString();
    }

    private String metadata(String alias) throws Exception {
        return mockMvc.perform(get("/saml2/service-provider-metadata/{alias}", alias))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private static Map<String, Object> settings(String alias) throws Exception {
        Map<String, Object> settings = new HashMap<>();
        settings.put("registrationId", alias);
        settings.put("alias", alias);
        settings.put("providerType", "saml");
        settings.put("displayName", "SAML integration test");
        settings.put("iconKey", "generic");
        settings.put("enabled", true);
        for (String flag :
                new String[] {
                    "shortStateParameter",
                    "caseSensitiveUsername",
                    "hideOnLogin",
                    "accountLinkingOnly",
                    "trustEmail",
                    "mfaRequired",
                    "storeTokens",
                    "storedTokensReadable",
                    "samlSignAuthnRequests",
                    "samlForceAuthentication",
                    "samlPassSubject"
                }) {
            settings.put(flag, false);
        }
        settings.put("guiOrder", 0);
        settings.put("showInAccountConsole", "always");
        settings.put("syncMode", "import");
        settings.put("clientAuthenticationMethod", "client_secret_basic");
        settings.put("scopes", "openid");
        settings.put("userNameAttribute", "sub");
        settings.put("samlAssertingPartyEntityId", "https://idp.example.test/entity");
        settings.put("samlSingleSignOnServiceUrl", "https://idp.example.test/sso");
        settings.put("samlSingleLogoutServiceUrl", "https://idp.example.test/slo");
        settings.put(
                "samlIdpCertificate",
                new ClassPathResource("saml/idp.crt").getContentAsString(StandardCharsets.UTF_8));
        settings.put("samlResponseBinding", "POST");
        settings.put("samlAuthnRequestBinding", "REDIRECT");
        settings.put("samlLogoutBinding", "REDIRECT");
        settings.put("samlWantAssertionsSigned", true);
        return settings;
    }

    private static JwtRequestPostProcessor admin() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
