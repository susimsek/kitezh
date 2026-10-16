package io.github.susimsek.kitezh.web.authz;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import org.junit.jupiter.api.Test;

class UmaDiscoveryControllerTest {

    @Test
    void advertisesUmaAndTokenServiceEndpoints() {
        UmaDiscoveryController controller = new UmaDiscoveryController(new ApplicationProperties());

        assertThat(controller.configuration())
                .containsEntry("token_endpoint", "http://127.0.0.1:9090/oauth2/token")
                .containsEntry(
                        "token_introspection_endpoint", "http://127.0.0.1:9090/oauth2/introspect")
                .containsEntry(
                        "permission_endpoint",
                        "http://127.0.0.1:9090/api/authz/protection/permission")
                .containsEntry(
                        "grant_types_supported",
                        java.util.List.of(AuthorizationGrantTypes.UMA_TICKET));
    }
}
