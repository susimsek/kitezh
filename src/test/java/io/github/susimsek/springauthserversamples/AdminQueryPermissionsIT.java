package io.github.susimsek.springauthserversamples;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class AdminQueryPermissionsIT {

    @Autowired private MockMvc mockMvc;

    @Test
    void userQueryPermissionOnlyDiscoversUsers() throws Exception {
        mockMvc.perform(get("/api/admin/users").with(queryUser())).andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/users/{id}", 2).with(queryUser()))
                .andExpect(status().isForbidden());
    }

    @Test
    void viewerPermissionCanReadUsersButCannotMutateThem() throws Exception {
        mockMvc.perform(get("/api/admin/users").with(userViewer())).andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/users/{id}", 2).with(userViewer()))
                .andExpect(status().isOk());

        mockMvc.perform(
                        put("/api/admin/users/{id}/enabled", 2)
                                .with(userViewer())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"enabled\":false}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void groupQueryPermissionOnlyDiscoversGroups() throws Exception {
        mockMvc.perform(get("/api/admin/groups").with(queryGroup())).andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/groups/{id}", 1).with(queryGroup()))
                .andExpect(status().isForbidden());
    }

    @Test
    void viewerPermissionCanReadGroups() throws Exception {
        mockMvc.perform(get("/api/admin/groups").with(groupViewer())).andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/groups/{id}", 1).with(groupViewer()))
                .andExpect(status().isOk());
    }

    @Test
    void clientQueryPermissionOnlyDiscoversClients() throws Exception {
        mockMvc.perform(get("/api/admin/clients").with(queryClient())).andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/clients/{id}", "missing").with(queryClient()))
                .andExpect(status().isForbidden());
    }

    @Test
    void viewerPermissionCanReadClientsAndClientScopes() throws Exception {
        mockMvc.perform(get("/api/admin/clients").with(clientViewer())).andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/clients/{id}", "missing").with(clientViewer()))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/admin/client-scopes").with(clientViewer()))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/client-scopes/{id}", "missing").with(clientViewer()))
                .andExpect(status().isNotFound());
    }

    private static org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor
            queryUser() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_USER_QUERY"));
    }

    private static org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor
            userViewer() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_USER_VIEWER"));
    }

    private static org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor
            queryGroup() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_GROUP_QUERY"));
    }

    private static org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor
            groupViewer() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_GROUP_VIEWER"));
    }

    private static org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor
            queryClient() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_CLIENT_QUERY"));
    }

    private static org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor
            clientViewer() {
        return jwt().jwt(token -> token.subject("admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_CLIENT_VIEWER"));
    }
}
