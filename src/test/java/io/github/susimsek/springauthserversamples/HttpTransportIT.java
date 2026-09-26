package io.github.susimsek.springauthserversamples;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

@SpringBootTest(
        classes = SpringAuthorizationServerSamplesApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class HttpTransportIT {

    @LocalServerPort private int port;

    @Value("${app.authorization-server.issuer}")
    private String configuredIssuer;

    @Test
    void liveHttpExposesDiscoveryReadinessAndClientCredentialsLifecycle() {
        RestClient client = RestClient.builder().baseUrl("http://127.0.0.1:" + port).build();

        JsonNode discovery =
                client.get()
                        .uri("/.well-known/openid-configuration")
                        .retrieve()
                        .body(JsonNode.class);
        assertThat(discovery).isNotNull();
        assertThat(discovery.path("issuer").asText()).isEqualTo(configuredIssuer);
        assertThat(discovery.path("token_endpoint").asText()).endsWith("/oauth2/token");
        assertThat(discovery.path("jwks_uri").asText()).endsWith("/oauth2/jwks");

        String readiness =
                client.get().uri("/actuator/health/readiness").retrieve().body(String.class);
        assertThat(readiness).contains("\"status\":\"UP\"");

        JsonNode token =
                client.post()
                        .uri("/oauth2/token")
                        .headers(headers -> headers.setBasicAuth("demo-client", "demo-secret"))
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body("grant_type=client_credentials&scope=openid")
                        .retrieve()
                        .body(JsonNode.class);
        assertThat(token).isNotNull();
        String accessToken = token.path("access_token").asText();
        assertThat(accessToken).isNotBlank();

        JsonNode active =
                client.post()
                        .uri("/oauth2/introspect")
                        .headers(headers -> headers.setBasicAuth("demo-client", "demo-secret"))
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body("token=" + accessToken)
                        .retrieve()
                        .body(JsonNode.class);
        assertThat(active).isNotNull();
        assertThat(active.path("active").asBoolean()).isTrue();

        client.post()
                .uri("/oauth2/revoke")
                .headers(headers -> headers.setBasicAuth("demo-client", "demo-secret"))
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body("token=" + accessToken)
                .retrieve()
                .toBodilessEntity();

        JsonNode inactive =
                client.post()
                        .uri("/oauth2/introspect")
                        .headers(headers -> headers.setBasicAuth("demo-client", "demo-secret"))
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body("token=" + accessToken)
                        .retrieve()
                        .body(JsonNode.class);
        assertThat(inactive).isNotNull();
        assertThat(inactive.path("active").asBoolean()).isFalse();
    }
}
