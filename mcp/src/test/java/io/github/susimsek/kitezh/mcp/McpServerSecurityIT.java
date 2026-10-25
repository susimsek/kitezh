package io.github.susimsek.kitezh.mcp;

import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.kitezh.mcp.service.client.KitezhAdminApiHttpClient;
import io.github.susimsek.kitezh.mcp.tool.KitezhMcpTools;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
        properties = {
            "app.mcp.public-url=https://kitezh-mcp.onrender.com/mcp",
            "app.api.base-url=http://localhost:9090",
            "app.cors.allowed-origins=app://renderer,http://localhost:6274,http://127.0.0.1:6274"
        })
@AutoConfigureMockMvc
class McpServerSecurityIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private KitezhMcpTools tools;
    @MockitoBean private KitezhAdminApiHttpClient adminApiHttpClient;

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
    void exposesRoleFilteredResourcesPromptsAndCompletions() throws Exception {
        when(adminApiHttpClient.get(any(URI.class)))
                .thenReturn(Map.of("id", 42, "username", "demo"));
        var userViewer =
                SecurityMockMvcRequestPostProcessors.jwt()
                        .jwt(jwt -> jwt.audience(List.of("https://kitezh-mcp.onrender.com/mcp")))
                        .authorities(
                                new SimpleGrantedAuthority("SCOPE_mcp.read"),
                                new SimpleGrantedAuthority("ROLE_USER_VIEWER"));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(userViewer)
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":11,"method":"resources/templates/list","params":{}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.result.resourceTemplates[*].uriTemplate")
                                .value(org.hamcrest.Matchers.hasItem("kitezh://users/{userId}")))
                .andExpect(
                        jsonPath("$.result.resourceTemplates[*].uriTemplate")
                                .value(org.hamcrest.Matchers.hasItem("kitezh://groups/{groupId}")))
                .andExpect(
                        jsonPath("$.result.resourceTemplates[*].uriTemplate")
                                .value(
                                        org.hamcrest.Matchers.not(
                                                org.hamcrest.Matchers.hasItem(
                                                        "kitezh://clients/{clientRecordId}"))));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(userViewer)
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":12,"method":"resources/read","params":{"uri":"kitezh://users/42"}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.contents[0].mimeType").value("application/json"))
                .andExpect(
                        jsonPath("$.result.contents[0].text")
                                .value(containsString("\"username\":\"demo\"")));
        verify(adminApiHttpClient).get(URI.create("http://localhost:9090/api/admin/users/42"));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(userViewer)
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":13,"method":"prompts/list","params":{}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.prompts[0].name").value("review_resource"));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(userViewer)
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":14,"method":"prompts/get","params":{"name":"review_resource","arguments":{"resourceType":"users","resourceId":"42"}}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("kitezh://users/42")));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(userViewer)
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":15,"method":"completion/complete","params":{"ref":{"type":"ref/prompt","name":"review_resource"},"argument":{"name":"resourceType","value":"g"}}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.completion.values[0]").value("groups"));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(userViewer)
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":17,"method":"completion/complete","params":{"ref":{"type":"ref/prompt","name":"review_resource"},"argument":{"name":"resourceType","value":""}}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.result.completion.values")
                                .value(org.hamcrest.Matchers.contains("users", "groups")));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(userViewer)
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":18,"method":"prompts/get","params":{"name":"review_resource","arguments":{"resourceType":"clients","resourceId":"client-record"}}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error.code").value(-32601));
    }

    @Test
    void completesUserResourceIdsThroughTheAuthenticatedAdminApi() throws Exception {
        when(adminApiHttpClient.get(any(URI.class)))
                .thenReturn(Map.of("content", List.of(Map.of("id", 42), Map.of("id", 47))));
        var userViewer =
                SecurityMockMvcRequestPostProcessors.jwt()
                        .jwt(jwt -> jwt.audience(List.of("https://kitezh-mcp.onrender.com/mcp")))
                        .authorities(
                                new SimpleGrantedAuthority("SCOPE_mcp.read"),
                                new SimpleGrantedAuthority("ROLE_USER_VIEWER"));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(userViewer)
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":19,"method":"completion/complete","params":{"ref":{"type":"ref/resource","uri":"kitezh://users/{userId}"},"argument":{"name":"userId","value":"4"}}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.result.completion.values")
                                .value(org.hamcrest.Matchers.contains("42", "47")));

        verify(adminApiHttpClient)
                .get(
                        URI.create(
                                "http://localhost:9090/api/admin/users?page=0&size=100&sort=username,asc"));
    }

    @Test
    void deniesClientResourceIdCompletionWithoutClientRole() throws Exception {
        var userViewer =
                SecurityMockMvcRequestPostProcessors.jwt()
                        .jwt(jwt -> jwt.audience(List.of("https://kitezh-mcp.onrender.com/mcp")))
                        .authorities(
                                new SimpleGrantedAuthority("SCOPE_mcp.read"),
                                new SimpleGrantedAuthority("ROLE_USER_VIEWER"));

        mockMvc.perform(
                        post("/mcp")
                                .header("MCP-Protocol-Version", "2025-11-25")
                                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                                .contentType(MediaType.APPLICATION_JSON)
                                .with(userViewer)
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":20,"method":"completion/complete","params":{"ref":{"type":"ref/resource","uri":"kitezh://clients/{clientRecordId}"},"argument":{"name":"clientRecordId","value":"a"}}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error.code").value(-32601));

        verifyNoInteractions(adminApiHttpClient);
    }

    @Test
    void rejectsResourceReadsWithoutTheMatchingRole() throws Exception {
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
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_USER_VIEWER")))
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":16,"method":"resources/read","params":{"uri":"kitezh://clients/client-record"}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error.code").value(-32601))
                .andExpect(jsonPath("$.error.message").value("Capability not found"));

        verifyNoInteractions(adminApiHttpClient);
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
