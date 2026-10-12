package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
@TestPropertySource(properties = "app.authorization-server.issuer=https://issuer.example")
class IssuerOverrideIT {

    @Autowired private MockMvc mockMvc;

    @Autowired private ApplicationProperties applicationProperties;

    @Autowired private AuthorizationServerSettings authorizationServerSettings;

    @Test
    void discoveryUsesConfiguredIssuer() throws Exception {
        assertThat(applicationProperties.authorizationServer().issuer())
                .isEqualTo("https://issuer.example");
        assertThat(authorizationServerSettings.getIssuer()).isEqualTo("https://issuer.example");

        mockMvc.perform(get("/.well-known/openid-configuration"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.issuer").value("https://issuer.example"))
                .andExpect(
                        jsonPath("$.token_endpoint").value("https://issuer.example/oauth2/token"));
    }
}
