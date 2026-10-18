package io.github.susimsek.kitezh.mcp;

import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.kitezh.mcp.tool.KitezhMcpTools;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class McpServerSecurityIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private KitezhMcpTools tools;

    @Test
    void publishesProtectedResourceMetadata() throws Exception {
        mockMvc.perform(get("/.well-known/oauth-protected-resource"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("authorization_servers")))
                .andExpect(content().string(containsString("mcp.read")));
    }

    @Test
    void keepsReadinessPublic() throws Exception {
        mockMvc.perform(get("/actuator/health/readiness")).andExpect(status().isOk());
    }

    @Test
    void requiresBearerAuthenticationAndAdvertisesMetadata() throws Exception {
        mockMvc.perform(post("/mcp"))
                .andExpect(status().isUnauthorized())
                .andExpect(
                        header().string(
                                        "WWW-Authenticate",
                                        containsString(".well-known/oauth-protected-resource")));
    }

    @Test
    void advertisesConfiguredMetadataUrlInsteadOfForwardedHost() throws Exception {
        mockMvc.perform(
                        post("/mcp")
                                .header("X-Forwarded-Host", "attacker.example")
                                .header("X-Forwarded-Proto", "http"))
                .andExpect(status().isUnauthorized())
                .andExpect(
                        header().string(
                                        "WWW-Authenticate",
                                        containsString(
                                                "https://kitezh-mcp.onrender.com/.well-known/oauth-protected-resource")));
    }

    @Test
    void rejectsUntrustedHostAndOrigin() throws Exception {
        mockMvc.perform(post("/mcp").header("Host", "attacker.example"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/mcp").header("Host", "kitezh-mcp.onrender.com"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/mcp").header("Origin", "https://attacker.example"))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsConfiguredInspectorOriginPreflight() throws Exception {
        mockMvc.perform(
                        options("/mcp")
                                .header("Origin", "http://localhost:6274")
                                .header("Access-Control-Request-Method", "POST")
                                .header(
                                        "Access-Control-Request-Headers",
                                        "authorization,content-type,mcp-protocol-version"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:6274"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void rejectsMcpRequestsLargerThanOneMegabyte() throws Exception {
        mockMvc.perform(post("/mcp").content(new byte[1_048_577])).andExpect(status().is(413));
    }

    @Test
    void protectsMetricsAndRequiresMcpReadScope() throws Exception {
        mockMvc.perform(get("/actuator/metrics")).andExpect(status().isUnauthorized());
        mockMvc.perform(
                        get("/actuator/metrics")
                                .with(
                                        SecurityMockMvcRequestPostProcessors.jwt()
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_mcp.read"))))
                .andExpect(status().isOk());
    }

    @Test
    void initializesStatelessProtocolAndListsReadOnlyTools() throws Exception {
        String protocolHeaders = "2025-11-25";
        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", protocolHeaders)
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(
                                        SecurityMockMvcRequestPostProcessors.jwt()
                                                .jwt(
                                                        jwt ->
                                                                jwt.audience(
                                                                        List.of(
                                                                                "https://kitezh-mcp.onrender.com/mcp")))
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_mcp.read")))
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"kitezh-test","version":"1.0"}}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.protocolVersion").value(protocolHeaders));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", protocolHeaders)
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(
                                        SecurityMockMvcRequestPostProcessors.jwt()
                                                .jwt(
                                                        jwt ->
                                                                jwt.audience(
                                                                        List.of(
                                                                                "https://kitezh-mcp.onrender.com/mcp")))
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_mcp.read"),
                                                        new SimpleGrantedAuthority("ROLE_ADMIN")))
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.tools.length()").value(40))
                .andExpect(jsonPath("$.result.tools[0].annotations.readOnlyHint").value(true))
                .andExpect(jsonPath("$.result.tools[0].annotations.destructiveHint").value(false));
    }

    @Test
    void limitsToolDiscoveryAndCallsToGrantedAuthorities() throws Exception {
        String protocolVersion = "2025-11-25";
        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", protocolVersion)
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(
                                        SecurityMockMvcRequestPostProcessors.jwt()
                                                .jwt(
                                                        jwt ->
                                                                jwt.audience(
                                                                        List.of(
                                                                                "https://kitezh-mcp.onrender.com/mcp")))
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_mcp.read"),
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_USER_VIEWER")))
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":3,"method":"tools/list","params":{}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.result.tools[*].name")
                                .value(org.hamcrest.Matchers.hasItem("search_users")))
                .andExpect(
                        jsonPath("$.result.tools[*].name")
                                .value(
                                        org.hamcrest.Matchers.not(
                                                org.hamcrest.Matchers.hasItem("search_clients"))))
                .andExpect(
                        jsonPath("$.result.tools[*].name")
                                .value(
                                        org.hamcrest.Matchers.not(
                                                org.hamcrest.Matchers.hasItem(
                                                        "list_signing_key_metadata"))));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", protocolVersion)
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(
                                        SecurityMockMvcRequestPostProcessors.jwt()
                                                .jwt(
                                                        jwt ->
                                                                jwt.audience(
                                                                        List.of(
                                                                                "https://kitezh-mcp.onrender.com/mcp")))
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_mcp.read"),
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_USER_VIEWER")))
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"search_clients","arguments":{}}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error.code").value(-32601))
                .andExpect(jsonPath("$.error.message").value("Tool not found"));
    }

    @Test
    void hidesEveryToolFromTokensWithoutKnownKitezhRoles() throws Exception {
        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(
                                        SecurityMockMvcRequestPostProcessors.jwt()
                                                .jwt(
                                                        jwt ->
                                                                jwt.audience(
                                                                        List.of(
                                                                                "https://kitezh-mcp.onrender.com/mcp")))
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_mcp.read"),
                                                        new SimpleGrantedAuthority("ROLE_UNKNOWN")))
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":5,"method":"tools/list","params":{}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.tools.length()").value(0));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(
                                        SecurityMockMvcRequestPostProcessors.jwt()
                                                .jwt(
                                                        jwt ->
                                                                jwt.audience(
                                                                        List.of(
                                                                                "https://kitezh-mcp.onrender.com/mcp")))
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_mcp.read"),
                                                        new SimpleGrantedAuthority("ROLE_UNKNOWN")))
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"get_context","arguments":{}}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error.code").value(-32601))
                .andExpect(jsonPath("$.error.message").value("Tool not found"));
    }

    @Test
    void mapsSignedRoleClaimsToToolAuthorities() throws Exception {
        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(
                                        SecurityMockMvcRequestPostProcessors.jwt()
                                                .jwt(
                                                        jwt ->
                                                                jwt.audience(
                                                                                List.of(
                                                                                        "https://kitezh-mcp.onrender.com/mcp"))
                                                                        .claim("scope", "mcp.read")
                                                                        .claim(
                                                                                "roles",
                                                                                List.of(
                                                                                        "ROLE_USER_VIEWER")))
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_mcp.read"),
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_USER_VIEWER")))
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":7,"method":"tools/list","params":{}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.result.tools[*].name")
                                .value(org.hamcrest.Matchers.hasItem("search_users")))
                .andExpect(
                        jsonPath("$.result.tools[*].name")
                                .value(
                                        org.hamcrest.Matchers.not(
                                                org.hamcrest.Matchers.hasItem("search_clients"))));
    }

    @Test
    void exportsBoundedToolMetricsForGrafana() throws Exception {
        assertThatIllegalArgumentException().isThrownBy(() -> tools.getUser(0L));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(
                                        SecurityMockMvcRequestPostProcessors.jwt()
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_mcp.read")))
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":8,"method":"tools/list","params":{}}
                                        """))
                .andExpect(status().isOk());

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(
                                        SecurityMockMvcRequestPostProcessors.jwt()
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_mcp.read"),
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_USER_VIEWER")))
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"search_clients","arguments":{}}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error.code").value(-32601));

        mockMvc.perform(
                        get("/actuator/prometheus")
                                .with(
                                        SecurityMockMvcRequestPostProcessors.jwt()
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_mcp.read"))))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("kitezh_mcp_tool_calls_total")))
                .andExpect(content().string(containsString("status=\"client_error\"")))
                .andExpect(
                        content()
                                .string(
                                        containsString(
                                                "mcp_server_operation_duration_seconds_bucket")))
                .andExpect(content().string(containsString("method=\"tools/list\"")))
                .andExpect(content().string(containsString("tool_name=\"search_clients\"")))
                .andExpect(content().string(containsString("error_type=\"authorization\"")))
                .andExpect(
                        content()
                                .string(
                                        containsString(
                                                "kitezh_mcp_tool_call_duration_seconds_bucket")))
                .andExpect(content().string(containsString("service_name=\"kitezh-mcp\"")));
    }
}
