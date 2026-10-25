package io.github.susimsek.kitezh.mcp.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import io.github.susimsek.kitezh.mcp.config.ApplicationProperties;
import io.github.susimsek.kitezh.mcp.config.http.KitezhApiAuthenticationInterceptor;
import io.github.susimsek.kitezh.mcp.service.client.KitezhAdminApiHttpClient;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

class KitezhAdminApiClientTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void forwardsUserTokenAndCallsAdminApiWithBoundedQueryParameters() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        KitezhAdminApiClient client =
                new KitezhAdminApiClient(
                        httpClient(builder),
                        new SimpleMeterRegistry(),
                        properties("https://kitezh.test"));
        setAuthenticatedUser();
        server.expect(method(HttpMethod.GET))
                .andExpect(requestTo("https://kitezh.test/api/admin/users?page=0&q=alice&size=20"))
                .andExpect(header("Authorization", "Bearer subject-token"))
                .andRespond(
                        withSuccess(
                                "{\"content\":[{\"username\":\"alice\"}]}",
                                MediaType.APPLICATION_JSON));

        assertThat(
                        (Object)
                                client.get(
                                        "search_users",
                                        "/api/admin/users",
                                        java.util.Map.of("q", "alice", "page", 0, "size", 20)))
                .isNotNull();
        server.verify();
    }

    @Test
    void mapsUpstreamFailureToGenericApiExceptionAndRecordsOutcome() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        KitezhAdminApiClient client =
                new KitezhAdminApiClient(
                        httpClient(builder), registry, properties("https://kitezh.test"));
        setAuthenticatedUser();
        server.expect(requestTo("https://kitezh.test/api/admin/whoami"))
                .andRespond(withServerError());

        assertThatThrownBy(() -> client.get("get_context", "/api/admin/whoami", java.util.Map.of()))
                .isInstanceOf(KitezhAdminApiClient.KitezhApiException.class)
                .hasMessage("Kitezh API request failed");
        assertThat(
                        registry.get("kitezh_mcp_kitezh_api_requests_total")
                                .tag("outcome", "error")
                                .counter()
                                .count())
                .isEqualTo(1);
        server.verify();
    }

    @Test
    void readsJsonArrayResponsesAsTypedMaps() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        KitezhAdminApiClient client =
                new KitezhAdminApiClient(
                        httpClient(builder),
                        new SimpleMeterRegistry(),
                        properties("https://kitezh.test"));
        setAuthenticatedUser();
        server.expect(method(HttpMethod.GET))
                .andExpect(requestTo("https://kitezh.test/api/admin/groups/3/permissions"))
                .andExpect(header("Authorization", "Bearer subject-token"))
                .andRespond(
                        withSuccess(
                                "[{\"userId\":2,\"username\":\"alice\","
                                        + "\"permission\":\"MANAGE_MEMBERS\"}]",
                                MediaType.APPLICATION_JSON));

        assertThat(
                        client.getList(
                                "get_group_permissions",
                                "/api/admin/groups/3/permissions",
                                Map.of()))
                .containsExactly(
                        Map.of("userId", 2, "username", "alice", "permission", "MANAGE_MEMBERS"));
        server.verify();
    }

    @Test
    void mapsArrayEndpointFailureToGenericApiExceptionAndRecordsOutcome() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        KitezhAdminApiClient client =
                new KitezhAdminApiClient(
                        httpClient(builder), registry, properties("https://kitezh.test"));
        setAuthenticatedUser();
        server.expect(requestTo("https://kitezh.test/api/admin/groups/3/permissions"))
                .andRespond(withServerError());

        assertThatThrownBy(
                        () ->
                                client.getList(
                                        "get_group_permissions",
                                        "/api/admin/groups/3/permissions",
                                        Map.of()))
                .isInstanceOf(KitezhAdminApiClient.KitezhApiException.class)
                .hasMessage("Kitezh API request failed");
        assertThat(
                        registry.get("kitezh_mcp_kitezh_api_requests_total")
                                .tag("outcome", "error")
                                .counter()
                                .count())
                .isEqualTo(1);
        server.verify();
    }

    @Test
    void rejectsCallsWithoutAnAuthenticatedJwt() {
        KitezhAdminApiClient client =
                new KitezhAdminApiClient(
                        httpClient(RestClient.builder()),
                        new SimpleMeterRegistry(),
                        properties("https://kitezh.test"));

        assertThatThrownBy(() -> client.get("get_context", "/api/admin/whoami", java.util.Map.of()))
                .isInstanceOf(KitezhAdminApiClient.KitezhApiException.class)
                .hasMessage("An authenticated Kitezh user is required");
    }

    private static void setAuthenticatedUser() {
        Jwt jwt =
                Jwt.withTokenValue("subject-token").header("alg", "none").subject("alice").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    private static ApplicationProperties properties(String apiBaseUrl) {
        return new ApplicationProperties(
                null, null, new ApplicationProperties.Api(apiBaseUrl), null, null);
    }

    private static KitezhAdminApiHttpClient httpClient(RestClient.Builder builder) {
        RestClient restClient =
                builder.requestInterceptor(new KitezhApiAuthenticationInterceptor()).build();
        HttpServiceProxyFactory factory =
                HttpServiceProxyFactory.builderFor(RestClientAdapter.create(restClient)).build();
        return factory.createClient(KitezhAdminApiHttpClient.class);
    }
}
