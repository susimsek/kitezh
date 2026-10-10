package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.kitezh.dto.admin.NativeAdminLoginSettingsRequestDTO;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
class NativeAdminLoginSettingsIT {

    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();

    @Autowired private MockMvc mockMvc;

    @Test
    void nativeSettingsAreAdminScopedAndNeverExposeTheCommonPasswordList() throws Exception {
        MvcResult getResult =
                mockMvc.perform(get("/api/admin/settings/login/native").with(adminAuthority()))
                        .andExpect(status().isOk())
                        .andReturn();
        JsonNode safeSettings = JSON_MAPPER.readTree(getResult.getResponse().getContentAsString());
        assertThat(safeSettings.has("passwordCommonPasswords")).isFalse();

        NativeAdminLoginSettingsRequestDTO request =
                JSON_MAPPER.treeToValue(safeSettings, NativeAdminLoginSettingsRequestDTO.class);
        NativeAdminLoginSettingsRequestDTO invalidRequest =
                new NativeAdminLoginSettingsRequestDTO(
                        request.userRegistration(),
                        request.forgotPassword(),
                        request.rememberMe(),
                        request.loginWithEmail(),
                        request.verifyEmail(),
                        request.sessionTimeoutMinutes(),
                        129,
                        request.bruteForceEnabled(),
                        request.bruteForceMaxFailures(),
                        request.otpEnabled(),
                        request.otpRequired(),
                        request.passkeys());
        mockMvc.perform(
                        put("/api/admin/settings/login/native")
                                .with(adminAuthority())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(JSON_MAPPER.writeValueAsBytes(invalidRequest)))
                .andExpect(status().isBadRequest());

        MvcResult updateResult =
                mockMvc.perform(
                                put("/api/admin/settings/login/native")
                                        .with(adminAuthority())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(JSON_MAPPER.writeValueAsBytes(request)))
                        .andExpect(status().isOk())
                        .andReturn();
        JsonNode updatedSettings =
                JSON_MAPPER.readTree(
                        updateResult.getResponse().getContentAsString(StandardCharsets.UTF_8));
        assertThat(updatedSettings.has("passwordCommonPasswords")).isFalse();

        mockMvc.perform(
                        get("/api/admin/settings/login/native")
                                .with(
                                        jwt().authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_admin-api"))))
                .andExpect(status().isForbidden());
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor
            adminAuthority() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
