package io.github.susimsek.kitezh;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class UserProfileEndpointsIT {

    @Autowired private MockMvc mockMvc;

    @Test
    void userViewerCanReadEnabledProfileDefinitions() throws Exception {
        mockMvc.perform(
                        get("/api/admin/profile-attributes")
                                .with(
                                        jwt().authorities(
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_USER_VIEWER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("username"));
    }

    @Test
    void profileDefinitionManagementRemainsAdminOnly() throws Exception {
        mockMvc.perform(
                        get("/api/admin/settings/user-profile")
                                .with(
                                        jwt().authorities(
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_USER_MANAGER"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void administratorCanSearchPagedProfileDefinitions() throws Exception {
        mockMvc.perform(
                        get("/api/admin/settings/user-profile/page")
                                .param("q", "department")
                                .param("page", "0")
                                .param("size", "10")
                                .param("sort", "displayOrder,asc")
                                .with(
                                        jwt().jwt(token -> token.subject("admin"))
                                                .authorities(
                                                        new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("department"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void administratorCannotSubmitDuplicateProfileAttributeOrder() throws Exception {
        mockMvc.perform(
                        put("/api/admin/settings/user-profile/order")
                                .contentType(APPLICATION_JSON)
                                .content("{\"ids\":[1,1]}")
                                .with(
                                        jwt().jwt(token -> token.subject("admin"))
                                                .authorities(
                                                        new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void administratorCanReadUserProfileAttributes() throws Exception {
        mockMvc.perform(
                        get("/api/admin/users/2/profile-attributes")
                                .with(
                                        jwt().jwt(token -> token.subject("admin"))
                                                .authorities(
                                                        new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.definitions[0].name").value("username"))
                .andExpect(jsonPath("$.attributes.department[0]").value("Sales"))
                .andExpect(jsonPath("$.attributes.employeeNumber[0]").value("USR-001"));
    }

    @Test
    void administratorCanUpdateUserProfileAttributes() throws Exception {
        mockMvc.perform(
                        put("/api/admin/users/2/profile-attributes")
                                .contentType(APPLICATION_JSON)
                                .content(
                                        "{\"attributes\":{\"department\":[\"Engineering\"],\"employeeNumber\":[\"EMP-001\"]}}")
                                .with(
                                        jwt().jwt(token -> token.subject("admin"))
                                                .authorities(
                                                        new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attributes.department[0]").value("Engineering"))
                .andExpect(jsonPath("$.attributes.employeeNumber[0]").value("EMP-001"));
    }
}
