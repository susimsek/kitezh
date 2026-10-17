package io.github.susimsek.kitezh.mcp;

import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
                                                                "SCOPE_mcp.read")))
                                .content(
                                        """
                                        {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.tools.length()").value(10))
                .andExpect(jsonPath("$.result.tools[0].annotations.readOnlyHint").value(true))
                .andExpect(jsonPath("$.result.tools[0].annotations.destructiveHint").value(false));
    }

    @Test
    void exportsBoundedToolMetricsForGrafana() throws Exception {
        assertThatIllegalArgumentException().isThrownBy(() -> tools.getUser(0L));

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
                                                "kitezh_mcp_tool_call_duration_seconds_bucket")))
                .andExpect(content().string(containsString("service_name=\"kitezh-mcp\"")));
    }
}
