package io.github.susimsek.kitezh;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class AdminOrganizationEndpointsIT {

    @Autowired private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void administratorCanCreateReadListAndUpdateOrganization() throws Exception {
        String alias = "it-org-" + UUID.randomUUID().toString().replace('-', 'a');
        String response =
                mockMvc.perform(
                                post("/api/admin/organizations")
                                        .with(admin())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                objectMapper.writeValueAsString(
                                                        Map.of(
                                                                "alias",
                                                                alias,
                                                                "name",
                                                                "IT Organization",
                                                                "redirectUrl",
                                                                "https://example.com/callback",
                                                                "enabled",
                                                                true,
                                                                "attributes",
                                                                Map.of(
                                                                        "tier",
                                                                        java.util.List.of(
                                                                                "test"))))))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.alias").value(alias))
                        .andExpect(jsonPath("$.attributes.tier[0]").value("test"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        long id = objectMapper.readTree(response).get("id").asLong();

        mockMvc.perform(get("/api/admin/organizations/{id}", id).with(viewer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("IT Organization"));

        mockMvc.perform(get("/api/admin/organizations").param("q", alias).with(viewer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].alias").value(alias));

        mockMvc.perform(
                        put("/api/admin/organizations/{id}", id)
                                .with(manager())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        objectMapper.writeValueAsString(
                                                Map.of(
                                                        "alias",
                                                        alias,
                                                        "name",
                                                        "Updated Organization",
                                                        "enabled",
                                                        false,
                                                        "attributes",
                                                        Map.of()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Organization"))
                .andExpect(jsonPath("$.enabled").value(false));

        String memberResponse =
                mockMvc.perform(
                                post("/api/admin/organizations/{id}/members", id)
                                        .with(manager())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"userId\":2,\"membershipType\":\"MANAGED\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.username").value("user"))
                        .andExpect(jsonPath("$.membershipType").value("MANAGED"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        long userId = objectMapper.readTree(memberResponse).get("userId").asLong();

        mockMvc.perform(
                        put("/api/admin/organizations/{id}/members/{userId}", id, userId)
                                .with(manager())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"userId\":2,\"membershipType\":\"UNMANAGED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.membershipType").value("UNMANAGED"));

        mockMvc.perform(
                        get("/api/admin/organizations/{id}/members", id)
                                .with(viewer())
                                .param("q", "user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].username").value("user"));

        mockMvc.perform(
                        post("/api/admin/organizations/{id}/domains", id)
                                .with(manager())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"domain\":\"acme-" + UUID.randomUUID() + ".example\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.domain").exists());

        mockMvc.perform(get("/api/admin/organizations/{id}/domains", id).with(viewer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content").isNotEmpty());
    }

    @Test
    void organizationAliasAndRedirectUrlAreValidated() throws Exception {
        mockMvc.perform(
                        post("/api/admin/organizations")
                                .with(admin())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"alias\":\"Invalid Alias\",\"name\":\"Invalid\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(
                        post("/api/admin/organizations")
                                .with(admin())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"alias\":\"invalid-redirect\",\"name\":\"Invalid\",\"redirectUrl\":\"/relative\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void organizationReadRequiresOrganizationViewerOrAdministrator() throws Exception {
        mockMvc.perform(get("/api/admin/organizations").with(groupViewer()))
                .andExpect(status().isForbidden());
    }

    @Test
    void administratorCanManageOrganizationGroupsProvidersAndInvitations() throws Exception {
        String alias = "it-org-extra-" + UUID.randomUUID().toString().replace('-', 'b');
        String organizationResponse =
                mockMvc.perform(
                                post("/api/admin/organizations")
                                        .with(admin())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                objectMapper.writeValueAsString(
                                                        Map.of(
                                                                "alias",
                                                                alias,
                                                                "name",
                                                                "Extra Organization"))))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        long id = objectMapper.readTree(organizationResponse).get("id").asLong();

        String groupResponse =
                mockMvc.perform(
                                post("/api/admin/organizations/{id}/groups", id)
                                        .with(manager())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"finance\",\"enabled\":true,\"roles\":[\"billing.read\"]}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.name").value("finance"))
                        .andExpect(jsonPath("$.roles[0]").value("billing.read"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        long groupId = objectMapper.readTree(groupResponse).get("id").asLong();

        mockMvc.perform(get("/api/admin/organizations/{id}/groups", id).with(viewer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("finance"));

        mockMvc.perform(
                        post("/api/admin/organizations/{id}/members", id)
                                .with(manager())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"userId\":2}"))
                .andExpect(status().isCreated());
        mockMvc.perform(
                        post("/api/admin/organizations/{id}/groups/{groupId}/members", id, groupId)
                                .with(manager())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"userId\":2}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("user"));

        mockMvc.perform(
                        post("/api/admin/organizations/{id}/identity-providers", id)
                                .with(manager())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"providerAlias\":\"google\",\"enabled\":true}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.providerAlias").value("google"));
        mockMvc.perform(get("/api/admin/organizations/{id}/identity-providers", id).with(viewer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].providerAlias").value("google"));

        String invitationResponse =
                mockMvc.perform(
                                post("/api/admin/organizations/{id}/invitations", id)
                                        .with(manager())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"email\":\"invite-"
                                                        + UUID.randomUUID()
                                                        + "@example.com\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.status").value("PENDING"))
                        .andExpect(jsonPath("$.token").isNotEmpty())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        long invitationId = objectMapper.readTree(invitationResponse).get("id").asLong();
        String email = objectMapper.readTree(invitationResponse).get("email").asText();

        mockMvc.perform(
                        post(
                                        "/api/admin/organizations/{id}/invitations/{invitationId}/resend",
                                        id,
                                        invitationId)
                                .with(manager())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("email", email))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
        mockMvc.perform(
                        post(
                                        "/api/admin/organizations/{id}/invitations/{invitationId}/cancel",
                                        id,
                                        invitationId)
                                .with(manager()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/admin/organizations/{id}/invitations", id).with(viewer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].status").value("CANCELLED"));
    }

    private static JwtRequestPostProcessor admin() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private static JwtRequestPostProcessor viewer() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_ORGANIZATION_VIEWER"));
    }

    private static JwtRequestPostProcessor manager() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_ORGANIZATION_MANAGER"));
    }

    private static JwtRequestPostProcessor groupViewer() {
        return jwt().jwt(token -> token.subject("user"))
                .authorities(new SimpleGrantedAuthority("ROLE_GROUP_VIEWER"));
    }
}
