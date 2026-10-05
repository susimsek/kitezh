package io.github.susimsek.kitezh;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class ImpersonationEndpointsIT {

    @Autowired private MockMvc mockMvc;

    @Test
    void dedicatedImpersonationAuthorityCanCreateHandoff() throws Exception {
        mockMvc.perform(
                        post("/api/admin/users/3/impersonation")
                                .with(
                                        jwt().jwt(token -> token.subject("user"))
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_USER_IMPERSONATOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("/impersonation/accept"))
                .andExpect(cookie().exists("IMPERSONATION_TICKET"));
    }

    @Test
    void userManagerCannotCreateImpersonationHandoffWithoutDedicatedAuthority() throws Exception {
        mockMvc.perform(
                        post("/api/admin/users/3/impersonation")
                                .with(
                                        jwt().jwt(token -> token.subject("user"))
                                                .authorities(
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_USER_MANAGER"))))
                .andExpect(status().isForbidden());
    }
}
