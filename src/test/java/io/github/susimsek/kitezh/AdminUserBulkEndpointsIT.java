package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class AdminUserBulkEndpointsIT {

    @Autowired private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void administratorCanApplyBulkEnableDisableAndDeleteOperations() throws Exception {
        List<Long> userIds = new ArrayList<>();
        String suffix = UUID.randomUUID().toString().replace("-", "");
        try {
            userIds.add(createUser("bulk-one-" + suffix));
            userIds.add(createUser("bulk-two-" + suffix));

            performBulk(userIds, "DISABLE")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.action").value("DISABLE"))
                    .andExpect(jsonPath("$.userCount").value(2));
            mockMvc.perform(get("/api/admin/users/{id}", userIds.getFirst()).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.enabled").value(false));

            performBulk(userIds, "ENABLE")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.action").value("ENABLE"));
            mockMvc.perform(get("/api/admin/users/{id}", userIds.getLast()).with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.enabled").value(true));

            performBulk(userIds, "DELETE")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.action").value("DELETE"));
            mockMvc.perform(get("/api/admin/users/{id}", userIds.getFirst()).with(admin()))
                    .andExpect(status().isNotFound());
        } finally {
            if (!userIds.isEmpty()) {
                mockMvc.perform(
                                post("/api/admin/users/bulk")
                                        .with(admin())
                                        .contentType(APPLICATION_JSON)
                                        .content(
                                                objectMapper.writeValueAsString(
                                                        java.util.Map.of(
                                                                "userIds", userIds, "action",
                                                                "DELETE"))))
                        .andExpect(
                                result ->
                                        assertThat(result.getResponse().getStatus())
                                                .isIn(200, 400, 404));
            }
        }
    }

    @Test
    void userViewerCannotRunBulkUserLifecycleOperations() throws Exception {
        mockMvc.perform(
                        post("/api/admin/users/bulk")
                                .with(viewer())
                                .contentType(APPLICATION_JSON)
                                .content("{\"userIds\":[2],\"action\":\"DISABLE\"}"))
                .andExpect(status().isForbidden());
    }

    private long createUser(String username) throws Exception {
        String response =
                mockMvc.perform(
                                post("/api/admin/users")
                                        .with(admin())
                                        .contentType(APPLICATION_JSON)
                                        .content(
                                                objectMapper.writeValueAsString(
                                                        java.util.Map.of(
                                                                "username",
                                                                username,
                                                                "password",
                                                                "Password-123456!",
                                                                "enabled",
                                                                true,
                                                                "roles",
                                                                List.of("ROLE_USER")))))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private org.springframework.test.web.servlet.ResultActions performBulk(
            List<Long> userIds, String action) throws Exception {
        return mockMvc.perform(
                post("/api/admin/users/bulk")
                        .with(admin())
                        .contentType(APPLICATION_JSON)
                        .content(
                                objectMapper.writeValueAsString(
                                        java.util.Map.of("userIds", userIds, "action", action))));
    }

    private static JwtRequestPostProcessor admin() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private static JwtRequestPostProcessor viewer() {
        return jwt().jwt(token -> token.subject("user"))
                .authorities(new SimpleGrantedAuthority("ROLE_USER_VIEWER"));
    }
}
