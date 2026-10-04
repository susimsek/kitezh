package io.github.susimsek.kitezh.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class HomeControllerTest {

    @Test
    void returnsApplicationMetadataLinks() {
        Map<String, Object> payload = new HomeController().index();

        assertThat(payload)
                .containsEntry("application", "kitezh")
                .containsEntry("metadata", "/.well-known/openid-configuration")
                .containsEntry("jwkSet", "/oauth2/jwks")
                .containsEntry("tokenEndpoint", "/oauth2/token")
                .containsEntry("authorizationEndpoint", "/oauth2/authorize");
    }
}
