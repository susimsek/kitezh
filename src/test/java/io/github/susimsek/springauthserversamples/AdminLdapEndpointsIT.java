package io.github.susimsek.springauthserversamples;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class AdminLdapEndpointsIT {

    @Autowired private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void administratorCanReadUpdateAndDeleteLdapProvider() throws Exception {
        String name = "LDAP IT " + UUID.randomUUID();
        String response =
                mockMvc.perform(
                                put("/api/admin/settings/ldap")
                                        .with(admin())
                                        .contentType(APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request(name))))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$[0].name").value(name))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        String id = objectMapper.readTree(response).get(0).get("id").asText();

        try {
            mockMvc.perform(get("/api/admin/settings/ldap").with(admin()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].name").value(name));
        } finally {
            mockMvc.perform(delete("/api/admin/settings/ldap/{id}", id).with(admin()))
                    .andExpect(status().isNoContent());
        }
    }

    @Test
    void nonAdministratorCannotManageLdapProviders() throws Exception {
        mockMvc.perform(get("/api/admin/settings/ldap").with(userViewer()))
                .andExpect(status().isForbidden());
    }

    private static Map<String, Object> request(String name) {
        Map<String, Object> provider = new java.util.LinkedHashMap<>();
        provider.put("name", name);
        provider.put("enabled", false);
        provider.put("priority", 10);
        provider.put("connectionUrl", "ldap://localhost:1389");
        provider.put("bindDn", "cn=admin,dc=example,dc=com");
        provider.put("bindPassword", "");
        provider.put("usersDn", "ou=users,dc=example,dc=com");
        provider.put("usernameAttribute", "uid");
        provider.put("uuidAttribute", "entryUUID");
        provider.put("emailAttribute", "mail");
        provider.put("firstNameAttribute", "givenName");
        provider.put("lastNameAttribute", "sn");
        provider.put("rdnAttribute", "uid");
        provider.put("objectClasses", "inetOrgPerson");
        provider.put("searchScope", "SUBTREE");
        provider.put("editMode", "READ_ONLY");
        provider.put("importUsers", true);
        provider.put("trustEmail", false);
        provider.put("syncRegistrations", false);
        provider.put("fullSyncIntervalMinutes", 0);
        provider.put("changedSyncIntervalMinutes", 0);
        provider.put("vendor", "LDAP");
        provider.put("authenticationType", "SIMPLE");
        provider.put("startTls", false);
        provider.put("trustStoreType", "JKS");
        provider.put("connectionPooling", false);
        provider.put("referral", "THROW");
        provider.put("connectTimeoutMs", 5000);
        provider.put("readTimeoutMs", 5000);
        provider.put("batchSize", 500);
        return Map.of("providers", java.util.List.of(provider));
    }

    private static org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor
            admin() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private static org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor
            userViewer() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_USER_VIEWER"));
    }
}
