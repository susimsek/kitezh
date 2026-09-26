package io.github.susimsek.springauthserversamples;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class AdminGroupEndpointsIT {

    @Autowired private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void adminCanCreateListReadAndManageGroupAttributesAndPermissions() throws Exception {
        String name = "it-group-" + UUID.randomUUID();
        Long groupId = null;
        try {
            String response =
                    mockMvc.perform(
                                    post("/api/admin/groups")
                                            .with(admin())
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content(
                                                    objectMapper.writeValueAsString(
                                                            java.util.Map.of(
                                                                    "name",
                                                                    name,
                                                                    "attributes",
                                                                    java.util.Map.of(
                                                                            "department",
                                                                            java.util.List.of(
                                                                                    "finance")),
                                                                    "defaultGroup",
                                                                    true))))
                            .andExpect(status().isCreated())
                            .andExpect(jsonPath("$.attributes.department[0]").value("finance"))
                            .andExpect(jsonPath("$.defaultGroup").value(true))
                            .andReturn()
                            .getResponse()
                            .getContentAsString();
            groupId = objectMapper.readTree(response).get("id").asLong();

            mockMvc.perform(get("/api/admin/groups/{id}", groupId).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value(name))
                    .andExpect(jsonPath("$.attributes.department[0]").value("finance"))
                    .andExpect(jsonPath("$.defaultGroup").value(true));

            mockMvc.perform(get("/api/admin/groups").param("q", name).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].name").value(name));

            mockMvc.perform(
                            put("/api/admin/groups/{id}/permissions", groupId)
                                    .with(admin())
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            "{\"permissions\":[{\"userId\":2,"
                                                    + "\"permission\":\"VIEW\"}]}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].username").value("user"))
                    .andExpect(jsonPath("$[0].permission").value("VIEW"));

            mockMvc.perform(get("/api/admin/groups/{id}/permissions", groupId).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].username").value("user"));

            mockMvc.perform(get("/api/admin/groups").param("q", name).with(user()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].name").value(name));

            mockMvc.perform(get("/api/admin/groups/{id}", groupId).with(user()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value(name));
        } finally {
            if (groupId != null) {
                mockMvc.perform(delete("/api/admin/groups/{id}", groupId).with(admin()))
                        .andExpect(status().isNoContent());
            }
        }
    }

    @Test
    void adminCanRenameMapRolesAndManageGroupMembership() throws Exception {
        String name = "it-membership-group-" + UUID.randomUUID();
        Long groupId = null;
        try {
            String response =
                    mockMvc.perform(
                                    post("/api/admin/groups")
                                            .with(admin())
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content(
                                                    objectMapper.writeValueAsString(
                                                            java.util.Map.of(
                                                                    "name",
                                                                    name,
                                                                    "attributes",
                                                                    java.util.Map.of(),
                                                                    "defaultGroup",
                                                                    false))))
                            .andExpect(status().isCreated())
                            .andReturn()
                            .getResponse()
                            .getContentAsString();
            groupId = objectMapper.readTree(response).get("id").asLong();

            String renamed = name + "-renamed";
            mockMvc.perform(
                            put("/api/admin/groups/{id}", groupId)
                                    .with(admin())
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            objectMapper.writeValueAsString(
                                                    java.util.Map.of(
                                                            "name",
                                                            renamed,
                                                            "attributes",
                                                            java.util.Map.of(),
                                                            "defaultGroup",
                                                            false))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value(renamed));

            mockMvc.perform(
                            put("/api/admin/groups/{id}/roles", groupId)
                                    .with(admin())
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"roles\":[\"ROLE_USER\"]}"))
                    .andExpect(status().isOk())
                    .andExpect(
                            jsonPath("$.roles").value(org.hamcrest.Matchers.hasItem("ROLE_USER")));

            mockMvc.perform(get("/api/admin/groups/{id}/available-users", groupId).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isArray());

            mockMvc.perform(
                            post("/api/admin/groups/{id}/users", groupId)
                                    .with(admin())
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"userId\":2}"))
                    .andExpect(status().isOk());

            mockMvc.perform(get("/api/admin/groups/{id}/users", groupId).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[?(@.username == 'user')]").isNotEmpty());

            mockMvc.perform(
                            delete("/api/admin/groups/{id}/users/{userId}", groupId, 2)
                                    .with(admin()))
                    .andExpect(status().isOk());
        } finally {
            if (groupId != null) {
                mockMvc.perform(delete("/api/admin/groups/{id}", groupId).with(admin()))
                        .andExpect(status().isNoContent());
            }
        }
    }

    private static JwtRequestPostProcessor admin() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private static JwtRequestPostProcessor user() {
        return jwt().jwt(token -> token.subject("user"))
                .authorities(new SimpleGrantedAuthority("ROLE_GROUP_VIEWER"));
    }
}
