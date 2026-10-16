package io.github.susimsek.kitezh.web.authz;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Publishes UMA 2.0 endpoint discovery for this single-issuer authorization server. */
@RestController
public class UmaDiscoveryController {

    private final ApplicationProperties applicationProperties;

    public UmaDiscoveryController(ApplicationProperties applicationProperties) {
        this.applicationProperties = applicationProperties;
    }

    @GetMapping("/.well-known/uma2-configuration")
    Map<String, Object> configuration() {
        String issuer = applicationProperties.authorizationServer().issuer();
        return Map.of(
                "issuer",
                issuer,
                "token_endpoint",
                issuer + "/oauth2/token",
                "token_introspection_endpoint",
                issuer + "/oauth2/introspect",
                "resource_registration_endpoint",
                issuer + "/api/authz/protection/resources",
                "permission_endpoint",
                issuer + "/api/authz/protection/permission",
                "grant_types_supported",
                List.of(AuthorizationGrantTypes.UMA_TICKET),
                "token_endpoint_auth_methods_supported",
                List.of("client_secret_basic", "client_secret_post"),
                "scopes_supported",
                List.of("uma_authorization", "uma_protection"));
    }
}
