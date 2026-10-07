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
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
class AuthenticationFlowEndpointsIT {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Autowired private MockMvc mockMvc;

    @Test
    void administratorCanManageSingleIssuerFlowGraphAndBindings() throws Exception {
        String alias = "custom-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String flowId =
                create(
                                "/api/admin/authentication/flows",
                                "{\"alias\":\""
                                        + alias
                                        + "\",\"name\":\"Custom"
                                        + " browser\",\"flowType\":\"BASIC\",\"priority\":10}")
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.topLevel").value(true))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        String id = JSON.readTree(flowId).path("id").asText();

        create(
                        "/api/admin/authentication/flows/" + id + "/sub-flows",
                        "{\"alias\":\""
                                + alias
                                + "-forms\",\"name\":\"Custom"
                                + " forms\",\"flowType\":\"FORM\",\"requirement\":\"REQUIRED\",\"priority\":20}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topLevel").value(false));

        create(
                        "/api/admin/authentication/flows/" + id + "/executions",
                        "{\"providerId\":\"username-password-form\",\"displayName\":\"Password\",\"requirement\":\"REQUIRED\",\"priority\":10}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.providerId").value("username-password-form"));

        create(
                        "/api/admin/authentication/flows/" + id + "/executions",
                        "{\"providerId\":\"otp-form\",\"displayName\":\"Configured"
                            + " OTP\",\"requirement\":\"REQUIRED\",\"configuration\":\"not-json\",\"priority\":30}")
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/admin/authentication/flows/" + id).with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executions[0].requirement").value("REQUIRED"))
                .andExpect(jsonPath("$.subFlows[0].requirement").value("REQUIRED"))
                .andExpect(jsonPath("$.nodes[0].nodeType").value("EXECUTION"))
                .andExpect(jsonPath("$.nodes[1].nodeType").value("SUB_FLOW"));

        mockMvc.perform(
                        post("/api/admin/authentication/flows/1/executions")
                                .with(admin())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"providerId\":\"otp-form\",\"displayName\":\"OTP\",\"requirement\":\"REQUIRED\",\"priority\":30}"))
                .andExpect(status().isConflict());

        String copyAlias = alias + "-copy";
        mockMvc.perform(
                        post("/api/admin/authentication/flows/" + id + "/copy")
                                .with(admin())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"alias\":\""
                                                + copyAlias
                                                + "\",\"name\":\"Copied browser\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alias").value(copyAlias))
                .andExpect(jsonPath("$.builtIn").value(false));

        mockMvc.perform(
                        put("/api/admin/authentication/bindings/POST_BROKER_LOGIN")
                                .with(admin())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"flowId\":" + id + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flowAlias").value(alias));

        mockMvc.perform(delete("/api/admin/authentication/flows/" + id).with(admin()))
                .andExpect(status().isConflict());

        mockMvc.perform(
                        delete("/api/admin/authentication/bindings/POST_BROKER_LOGIN")
                                .with(admin()))
                .andExpect(status().isOk());

        mockMvc.perform(
                        put("/api/admin/authentication/bindings/POST_BROKER_LOGIN")
                                .with(admin())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"flowId\":5}"))
                .andExpect(status().isOk());
    }

    @Test
    void nonAdministratorCannotReadAuthenticationFlows() throws Exception {
        mockMvc.perform(
                        get("/api/admin/authentication/flows")
                                .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_USER"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void seededBindingsAndProviderCatalogAreAvailable() throws Exception {
        mockMvc.perform(get("/api/admin/authentication/flows").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isNotEmpty());

        mockMvc.perform(get("/api/admin/authentication/bindings").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].bindingType").exists())
                .andExpect(jsonPath("$[0].flowAlias").value("browser"));

        mockMvc.perform(get("/api/admin/authentication/execution-providers").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@ == 'otp-form')]").isNotEmpty());
    }

    private org.springframework.test.web.servlet.ResultActions create(String path, String body)
            throws Exception {
        return mockMvc.perform(
                post(path).with(admin()).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static JwtRequestPostProcessor admin() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
