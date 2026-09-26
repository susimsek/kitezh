package io.github.susimsek.springauthserversamples;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.springauthserversamples.domain.SocialIdentityEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.SocialIdentityRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
@TestPropertySource(properties = "app.social-login.enabled=true")
class SocialLoginEndpointsIT {

    @Autowired private MockMvc mockMvc;

    @Autowired private SocialIdentityRepository socialIdentityRepository;

    @Autowired private UserRepository userRepository;

    @Test
    void publicProviderDiscoveryExposesProviderConfigurationState() throws Exception {
        mockMvc.perform(get("/api/auth/social-providers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void administratorCanReadSocialProviderSettingsWithoutReceivingSecrets() throws Exception {
        mockMvc.perform(
                        get("/api/admin/settings/social-providers")
                                .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].provider").isString())
                .andExpect(jsonPath("$[0].clientSecretConfigured").isBoolean())
                .andExpect(jsonPath("$[0].clientSecret").doesNotExist());
    }

    @Test
    void administratorCannotSubmitAnEmptySocialProviderUpdate() throws Exception {
        mockMvc.perform(
                        put("/api/admin/settings/social-providers")
                                .with(admin())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"providers\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void accountCanListAndRemoveItsOwnSocialLink() throws Exception {
        String username = "social-link-it-" + UUID.randomUUID();
        UserEntity user =
                userRepository.save(
                        new UserEntity(null, username, "{noop}test-password", true, Set.of()));
        try {
            socialIdentityRepository.save(
                    new SocialIdentityEntity("github", "subject-" + UUID.randomUUID(), user));

            mockMvc.perform(get("/api/account/social-links").with(accountUser(username)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].provider").value("github"))
                    .andExpect(jsonPath("$[0].linked").value(true))
                    .andExpect(jsonPath("$[0].configured").value(false));

            mockMvc.perform(delete("/api/account/social-links/github").with(accountUser(username)))
                    .andExpect(status().isNoContent());

            assertThat(socialIdentityRepository.findAllByUserUsername(username)).isEmpty();
        } finally {
            socialIdentityRepository.deleteAll(
                    socialIdentityRepository.findAllByUserUsername(username));
            userRepository.deleteById(user.getId());
        }
    }

    private static JwtRequestPostProcessor admin() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private static JwtRequestPostProcessor accountUser(String username) {
        return jwt().jwt(token -> token.subject(username))
                .authorities(new SimpleGrantedAuthority("SCOPE_account-api"));
    }
}
