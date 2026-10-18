package io.github.susimsek.kitezh;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class MobileAuthCapabilitiesIT {

    @Autowired private MockMvc mockMvc;

    @Test
    void exposesVersionedMobileAuthenticationCapabilitiesWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/api/auth/mobile/capabilities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contractVersion").value(1))
                .andExpect(
                        jsonPath("$.capabilities")
                                .value(
                                        containsInAnyOrder(
                                                "authorization_code_pkce",
                                                "native_password_login",
                                                "native_google_id_token_login",
                                                "native_passkey_login",
                                                "native_totp_mfa",
                                                "native_required_actions",
                                                "native_passkey_required_action_enrollment",
                                                "native_oauth_consent",
                                                "native_social_account_link")));
    }
}
