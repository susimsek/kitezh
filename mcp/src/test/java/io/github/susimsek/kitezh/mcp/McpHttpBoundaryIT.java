package io.github.susimsek.kitezh.mcp;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class McpHttpBoundaryIT {

    @Autowired private MockMvc mockMvc;

    @Test
    void mirrorsBackendCorsPolicyAndAllowsMcpProtocolHeaders() throws Exception {
        mockMvc.perform(
                        options("/mcp")
                                .header("Origin", "app://renderer")
                                .header("Access-Control-Request-Method", "POST")
                                .header(
                                        "Access-Control-Request-Headers",
                                        "authorization,content-type,accept,app-name,app-version,client-platform,os,dpop,x-requested-with,mcp-protocol-version,mcp-session-id,last-event-id"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "app://renderer"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"))
                .andExpect(header().string("Access-Control-Max-Age", "3600"));
    }

    @Test
    void allowsInspectorOriginWhenLocalHostsAreEnabled() throws Exception {
        mockMvc.perform(
                        options("/mcp")
                                .header("Origin", "http://localhost:6274")
                                .header("Access-Control-Request-Method", "POST")
                                .header(
                                        "Access-Control-Request-Headers",
                                        "authorization,content-type,mcp-protocol-version"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:6274"));
    }

    @Test
    void rejectsUnlistedOriginsAndMethods() throws Exception {
        mockMvc.perform(
                        options("/mcp")
                                .header("Origin", "https://untrusted.example")
                                .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());

        mockMvc.perform(
                        options("/mcp")
                                .header("Origin", "app://renderer")
                                .header("Access-Control-Request-Method", "CONNECT"))
                .andExpect(status().isForbidden());
    }

    @Test
    void leavesNonMcpRequestsOutsideMcpCorsPolicy() throws Exception {
        mockMvc.perform(
                        get("/actuator/health")
                                .header("Origin", "app://renderer")
                                .header("Host", "kitezh-mcp.onrender.com"))
                .andExpect(status().isOk());
    }
}
