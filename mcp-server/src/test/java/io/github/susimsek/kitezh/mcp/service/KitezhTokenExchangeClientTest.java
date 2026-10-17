package io.github.susimsek.kitezh.mcp.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import io.github.susimsek.kitezh.mcp.config.ApplicationProperties;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class KitezhTokenExchangeClientTest {

    @Test
    void obtainsActorTokenAndExchangesSubjectForTheAdminApiAudience() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        KitezhTokenExchangeClient client =
                new KitezhTokenExchangeClient(
                        builder.build(),
                        new SimpleMeterRegistry(),
                        properties(
                                "https://kitezh.test/oauth2/token", "mcp-server", "local-secret"));
        server.expect(method(HttpMethod.POST))
                .andExpect(requestTo("https://kitezh.test/oauth2/token"))
                .andExpect(
                        header(
                                "Authorization",
                                "Basic "
                                        + java.util.Base64.getEncoder()
                                                .encodeToString(
                                                        "mcp-server:local-secret".getBytes())))
                .andExpect(
                        content()
                                .string(
                                        org.hamcrest.Matchers.containsString(
                                                "grant_type=client_credentials")))
                .andExpect(
                        content().string(org.hamcrest.Matchers.containsString("scope=admin-api")))
                .andExpect(
                        content()
                                .string(
                                        org.hamcrest.Matchers.not(
                                                org.hamcrest.Matchers.containsString(
                                                        "scope=admin-api+roles"))))
                .andRespond(
                        withSuccess(
                                "{\"access_token\":\"actor-token\"}", MediaType.APPLICATION_JSON));
        server.expect(method(HttpMethod.POST))
                .andExpect(requestTo("https://kitezh.test/oauth2/token"))
                .andExpect(
                        content()
                                .string(org.hamcrest.Matchers.containsString("audience=admin-api")))
                .andExpect(
                        content()
                                .string(
                                        org.hamcrest.Matchers.containsString(
                                                "subject_token=subject-token")))
                .andExpect(
                        content()
                                .string(
                                        org.hamcrest.Matchers.containsString(
                                                "actor_token=actor-token")))
                .andExpect(
                        content()
                                .string(
                                        org.hamcrest.Matchers.containsString(
                                                "scope=admin-api+roles")))
                .andRespond(
                        withSuccess(
                                "{\"access_token\":\"delegated-token\"}",
                                MediaType.APPLICATION_JSON));

        Jwt subject =
                Jwt.withTokenValue("subject-token").header("alg", "none").subject("alice").build();
        assertThat(client.exchange(subject)).isEqualTo("delegated-token");
        server.verify();
    }

    @Test
    void rejectsMissingServiceCredentialsAndRecordsFailure() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        KitezhTokenExchangeClient client =
                new KitezhTokenExchangeClient(
                        RestClient.builder().build(),
                        registry,
                        properties("https://kitezh.test/oauth2/token", "mcp", ""));
        Jwt subject =
                Jwt.withTokenValue("subject-token").header("alg", "none").subject("alice").build();

        assertThatThrownBy(() -> client.exchange(subject))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("MCP service client credentials are not configured");
        assertThat(
                        registry.get("kitezh_mcp_token_exchange_requests_total")
                                .tag("outcome", "error")
                                .counter()
                                .count())
                .isEqualTo(1);
    }

    @Test
    void rejectsTokenEndpointResponsesWithoutAnAccessToken() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        KitezhTokenExchangeClient client =
                new KitezhTokenExchangeClient(
                        builder.build(),
                        new SimpleMeterRegistry(),
                        properties("https://kitezh.test/oauth2/token", "mcp", "secret"));
        server.expect(requestTo("https://kitezh.test/oauth2/token"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        Jwt subject =
                Jwt.withTokenValue("subject-token").header("alg", "none").subject("alice").build();

        assertThatThrownBy(() -> client.exchange(subject))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Kitezh token endpoint returned no actor token");
        server.verify();
    }

    private static ApplicationProperties properties(
            String tokenUri, String clientId, String clientSecret) {
        return new ApplicationProperties(
                null,
                new ApplicationProperties.Security(
                        "https://kitezh.test/oauth2/jwks",
                        tokenUri,
                        "https://kitezh-mcp.onrender.com/mcp"),
                null,
                new ApplicationProperties.Mcp(
                        "https://kitezh-mcp.onrender.com/mcp",
                        "",
                        false,
                        clientId,
                        clientSecret,
                        true,
                        null));
    }
}
