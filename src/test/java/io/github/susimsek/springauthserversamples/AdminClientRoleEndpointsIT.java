package io.github.susimsek.springauthserversamples;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.susimsek.springauthserversamples.repository.GroupRepository;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class AdminClientRoleEndpointsIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private GroupRepository groupRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void administratorCanManageClientRolesThroughClientDetailEndpoints() throws Exception {
        String name = "it-role-" + UUID.randomUUID();
        Long roleId = null;
        try {
            String response =
                    mockMvc.perform(
                                    post("/api/admin/clients/demo-client/roles")
                                            .with(admin())
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content(
                                                    objectMapper.writeValueAsString(
                                                            Map.of(
                                                                    "name",
                                                                    name,
                                                                    "description",
                                                                    "Integration role"))))
                            .andExpect(status().isCreated())
                            .andExpect(jsonPath("$.name").value(name))
                            .andExpect(jsonPath("$.clientId").value("demo-client"))
                            .andReturn()
                            .getResponse()
                            .getContentAsString();
            roleId = objectMapper.readTree(response).get("id").asLong();

            mockMvc.perform(
                            get("/api/admin/clients/demo-client/roles")
                                    .param("q", name)
                                    .with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].name").value(name));

            mockMvc.perform(
                            put("/api/admin/clients/demo-client/roles/{roleId}", roleId)
                                    .with(admin())
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            objectMapper.writeValueAsString(
                                                    Map.of(
                                                            "name",
                                                            name,
                                                            "description",
                                                            "Updated role"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.description").value("Updated role"));

            mockMvc.perform(
                            get("/api/admin/clients/demo-client/roles/{roleId}", roleId)
                                    .with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.role.name").value(name))
                    .andExpect(jsonPath("$.userCount").value(0));
        } finally {
            if (roleId != null) {
                mockMvc.perform(
                                delete("/api/admin/clients/demo-client/roles/{roleId}", roleId)
                                        .with(admin()))
                        .andExpect(status().isNoContent());
            }
        }
    }

    @Test
    void administratorCanAssignAndRemoveAGroupFromAClientRole() throws Exception {
        String name = "it-group-role-" + UUID.randomUUID();
        Long roleId = null;
        Long groupId =
                groupRepository
                        .findByNameContainingIgnoreCase("application-users", PageRequest.of(0, 10))
                        .getContent()
                        .getFirst()
                        .getId();
        try {
            String response =
                    mockMvc.perform(
                                    post("/api/admin/clients/demo-client/roles")
                                            .with(admin())
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content(
                                                    objectMapper.writeValueAsString(
                                                            Map.of(
                                                                    "name",
                                                                    name,
                                                                    "description",
                                                                    "Group role"))))
                            .andExpect(status().isCreated())
                            .andReturn()
                            .getResponse()
                            .getContentAsString();
            roleId = objectMapper.readTree(response).get("id").asLong();

            mockMvc.perform(
                            get(
                                            "/api/admin/clients/demo-client/roles/{roleId}/available-groups",
                                            roleId)
                                    .param("q", "application-users")
                                    .with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].name").value("application-users"));

            mockMvc.perform(
                            post(
                                            "/api/admin/clients/demo-client/roles/{roleId}/groups/{groupId}",
                                            roleId,
                                            groupId)
                                    .with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.groupCount").value(1))
                    .andExpect(jsonPath("$.groups.content[0].name").value("application-users"));

            mockMvc.perform(
                            delete(
                                            "/api/admin/clients/demo-client/roles/{roleId}/groups/{groupId}",
                                            roleId,
                                            groupId)
                                    .with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.groupCount").value(0));
        } finally {
            if (roleId != null) {
                mockMvc.perform(
                                delete("/api/admin/clients/demo-client/roles/{roleId}", roleId)
                                        .with(admin()))
                        .andExpect(status().isNoContent());
            }
        }
    }

    private static JwtRequestPostProcessor admin() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
