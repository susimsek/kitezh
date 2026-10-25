package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
@Transactional
class McpAdminApiSecurityIT {

    private static final String MCP_RESOURCE_AUDIENCE = "https://kitezh-mcp.onrender.com/mcp";
    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();

    @Autowired private MockMvc mockMvc;

    @Test
    void mcpTokenWithRequiredRoleCanReadAllowlistedAdminApiRoute() throws Exception {
        mockMvc.perform(get("/api/admin/users").with(mcpToken("mcp.read", "ROLE_USER_VIEWER")))
                .andExpect(status().isOk());
    }

    @Test
    void mcpTokenCanReadItsOwnAccessContext() throws Exception {
        mockMvc.perform(get("/api/admin/whoami").with(mcpToken("mcp.read", "ROLE_ADMIN")))
                .andExpect(status().isOk());
    }

    @Test
    void issuedPersonalAccessTokenCanReadAllowlistedRouteAndCannotWriteOrReadOtherRoutes()
            throws Exception {
        MvcResult creationResult =
                mockMvc.perform(
                                post("/api/account/personal-access-tokens")
                                        .with(accountToken())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"MCP security test\","
                                                        + "\"expiration\":\"7\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String response = creationResult.getResponse().getContentAsString(StandardCharsets.UTF_8);
        String accessToken = JSON_MAPPER.readTree(response).get("token").asString();
        assertThat(accessToken).isNotBlank();

        mockMvc.perform(
                        get("/api/admin/whoami")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk());

        mockMvc.perform(
                        get("/api/admin/users")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk());

        mockMvc.perform(
                        post("/api/admin/users")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(
                        get("/api/admin/settings/login/native")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void mcpTokenCannotWriteToAdminApiEvenWhenItHasAdminRole() throws Exception {
        mockMvc.perform(
                        post("/api/admin/users")
                                .with(mcpToken("mcp.read", "ROLE_ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void mcpTokenCannotReadAnUnallowlistedAdminApiRouteEvenWhenItHasAdminRole() throws Exception {
        mockMvc.perform(
                        get("/api/admin/settings/login/native")
                                .with(mcpToken("mcp.read", "ROLE_ADMIN")))
                .andExpect(status().isForbidden());
    }

    @Test
    void mcpAudienceWithoutMcpReadScopeCannotAccessAdminApi() throws Exception {
        mockMvc.perform(get("/api/admin/users").with(mcpToken("admin-api", "ROLE_ADMIN")))
                .andExpect(status().isForbidden());
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor mcpToken(
            String scopes, String authority) {
        return jwt().jwt(
                        token ->
                                token.subject("admin")
                                        .audience(List.of(MCP_RESOURCE_AUDIENCE, "admin-api"))
                                        .claim("scope", scopes))
                .authorities(new SimpleGrantedAuthority(authority));
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor
            accountToken() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("SCOPE_account-api"));
    }
}
