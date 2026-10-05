package io.github.susimsek.kitezh;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
class AdminClientEndpointsIT {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Autowired private MockMvc mockMvc;

    @Test
    void adminCanManageClientAndItsScopeAssignments() throws Exception {
        String clientId = "it-client-" + UUID.randomUUID().toString().replace("-", "");
        String request = clientRequest(clientId, "IT Client");
        String response =
                mockMvc.perform(
                                post("/api/admin/clients")
                                        .with(admin())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(request))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.client.clientId").value(clientId))
                        .andExpect(jsonPath("$.client.serviceAccountEnabled").value(true))
                        .andExpect(
                                jsonPath("$.client.serviceAccountUsername")
                                        .value("service-account-" + clientId))
                        .andExpect(jsonPath("$.clientSecret").isNotEmpty())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        String id = JSON.readTree(response).get("client").get("id").asString();

        try {
            mockMvc.perform(get("/api/admin/clients").param("q", clientId).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].clientId").value(clientId));

            mockMvc.perform(get("/api/admin/clients/{id}", id).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.clientName").value("IT Client"))
                    .andExpect(jsonPath("$.serviceAccountEnabled").value(true));

            mockMvc.perform(get("/api/admin/clients/{id}/service-account", id).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.username").value("service-account-" + clientId))
                    .andExpect(jsonPath("$.roleIds").isArray());

            mockMvc.perform(
                            put("/api/admin/clients/{id}/service-account/roles", id)
                                    .with(admin())
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"roleIds\":[],\"applicationRoles\":[]}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.roleIds").isArray());

            mockMvc.perform(
                            post("/api/admin/clients/{id}/service-account/revoke", id)
                                    .with(admin()))
                    .andExpect(status().isNoContent());

            mockMvc.perform(post("/api/admin/clients/{id}/secret", id).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.clientSecret").isNotEmpty());

            mockMvc.perform(
                            put("/api/admin/clients/{id}", id)
                                    .with(admin())
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(clientRequest(clientId, "Updated IT Client")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.clientName").value("Updated IT Client"));

            String mapperResponse =
                    mockMvc.perform(
                                    post("/api/admin/clients/{id}/mappers", id)
                                            .with(admin())
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content(
                                                    """
                                                    {
                                                      "name":"Email claim",
                                                      "mapperType":"user-property",
                                                      "source":"email",
                                                      "claimName":"email",
                                                      "addToIdToken":true,
                                                      "addToAccessToken":true
                                                    }
                                                    """))
                            .andExpect(status().isOk())
                            .andExpect(jsonPath("$.mapperType").value("user-property"))
                            .andReturn()
                            .getResponse()
                            .getContentAsString();
            long mapperId = JSON.readTree(mapperResponse).get("id").asLong();

            mockMvc.perform(get("/api/admin/clients/{id}/mappers", id).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].claimName").value("email"));

            mockMvc.perform(
                            put("/api/admin/clients/{id}/mappers/{mapperId}", id, mapperId)
                                    .with(admin())
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            """
                                            {
                                              "name":"Email claim",
                                              "mapperType":"user-property",
                                              "source":"email",
                                              "claimName":"email_address",
                                              "addToIdToken":true,
                                              "addToAccessToken":true
                                            }
                                            """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.claimName").value("email_address"));

            mockMvc.perform(
                            get("/api/admin/clients/{id}/scope-evaluation", id)
                                    .param("scopes", "openid profile")
                                    .param("subject", "admin")
                                    .with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.effectiveScopes[0]").value("openid"))
                    .andExpect(jsonPath("$.effectiveScopes[1]").value("profile"))
                    .andExpect(jsonPath("$.mappedClaims[0]").value("email_address"));

            mockMvc.perform(
                            delete("/api/admin/clients/{id}/mappers/{mapperId}", id, mapperId)
                                    .with(admin()))
                    .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/admin/clients/{id}/scope-assignments", id).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.availableScopes").isArray());

            mockMvc.perform(
                            put("/api/admin/clients/{id}/scope-assignments", id)
                                    .with(admin())
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            "{\"defaultScopes\":[\"openid\"],\"optionalScopes\":[]}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.defaultScopes[0]").value("openid"));

            mockMvc.perform(get("/api/admin/clients/{id}/sessions", id).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isArray());
            mockMvc.perform(get("/api/admin/clients/{id}/consents", id).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isArray());
            mockMvc.perform(get("/api/admin/clients/{id}/events", id).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isArray());
        } finally {
            mockMvc.perform(delete("/api/admin/clients/{id}", id).with(admin()))
                    .andExpect(status().isNoContent());
        }

        mockMvc.perform(get("/api/admin/clients/{id}", id).with(admin()))
                .andExpect(status().isNotFound());
    }

    private static String clientRequest(String clientId, String clientName) {
        return """
        {
          "clientId":"%s",
          "clientName":"%s",
          "clientAuthenticationMethods":["client_secret_basic"],
          "authorizationGrantTypes":["client_credentials"],
          "redirectUris":[],
          "postLogoutRedirectUris":[],
          "scopes":["openid","profile"],
          "requireAuthorizationConsent":false,
          "requireProofKey":false,
          "requireDpop":false,
          "requireDpopJkt":false,
          "dpopRefreshTokenOnly":false,
          "dpopSigningAlgorithms":["RS256","ES256"],
          "authorizationCodeTimeToLive":"PT5M",
          "accessTokenTimeToLive":"PT5M",
          "refreshTokenTimeToLive":"PT1H",
          "serviceAccountEnabled":true
        }
        """
                .formatted(clientId, clientName);
    }

    private static org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor
            admin() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
