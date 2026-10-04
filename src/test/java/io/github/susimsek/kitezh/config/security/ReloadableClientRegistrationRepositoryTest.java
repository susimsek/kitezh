package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;

class ReloadableClientRegistrationRepositoryTest {

    @Test
    void replacesRegistrationsByRegistrationId() {
        ClientRegistration google = registration("google", "old-client");
        ClientRegistration github = registration("github", "github-client");
        ReloadableClientRegistrationRepository repository =
                new ReloadableClientRegistrationRepository(List.of(google));

        assertThat(repository.findByRegistrationId("google")).isSameAs(google);
        assertThat(repository.findByRegistrationId("missing")).isNull();

        ClientRegistration replacement = registration("google", "new-client");
        repository.replace(List.of(replacement, github));

        assertThat(repository.findByRegistrationId("google")).isSameAs(replacement);
        assertThat(repository.findByRegistrationId("github")).isSameAs(github);
        assertThat(repository.findByRegistrationId("missing")).isNull();
    }

    private static ClientRegistration registration(String id, String clientId) {
        return ClientRegistration.withRegistrationId(id)
                .clientId(clientId)
                .clientSecret("secret")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizationUri("https://example.test/authorize")
                .tokenUri("https://example.test/token")
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                .scope("openid")
                .build();
    }
}
