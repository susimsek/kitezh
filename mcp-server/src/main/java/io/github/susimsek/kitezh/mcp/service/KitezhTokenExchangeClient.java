package io.github.susimsek.kitezh.mcp.service;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Component
public class KitezhTokenExchangeClient {

    private static final String ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

    private final RestClient restClient;
    private final MeterRegistry meterRegistry;
    private final String issuerUri;
    private final String clientId;
    private final String clientSecret;

    public KitezhTokenExchangeClient(
            RestClient.Builder restClientBuilder,
            MeterRegistry meterRegistry,
            @Value("${kitezh.security.issuer-uri}") String issuerUri,
            @Value("${kitezh.mcp.client-id}") String clientId,
            @Value("${kitezh.mcp.client-secret}") String clientSecret) {
        this.restClient = restClientBuilder.build();
        this.meterRegistry = meterRegistry;
        this.issuerUri = issuerUri;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    public String exchange(Jwt subjectToken) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String outcome = "success";
        try {
            return exchangeToken(subjectToken);
        } catch (RuntimeException exception) {
            outcome = "error";
            throw exception;
        } finally {
            meterRegistry
                    .counter("kitezh_mcp_token_exchange_requests_total", "outcome", outcome)
                    .increment();
            sample.stop(
                    Timer.builder("kitezh_mcp_token_exchange_duration_seconds")
                            .tag("outcome", outcome)
                            .register(meterRegistry));
        }
    }

    private String exchangeToken(Jwt subjectToken) {
        if (clientSecret.isBlank()) {
            throw new IllegalStateException("MCP service client credentials are not configured");
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange");
        form.add("subject_token", subjectToken.getTokenValue());
        form.add("subject_token_type", ACCESS_TOKEN_TYPE);
        form.add("audience", "admin-api");
        form.add("scope", "admin-api roles");
        form.add("actor_token", clientCredentialsToken());
        form.add("actor_token_type", ACCESS_TOKEN_TYPE);
        Map<?, ?> response =
                restClient
                        .post()
                        .uri(issuerUri + "/oauth2/token")
                        .headers(headers -> headers.setBasicAuth(clientId, clientSecret))
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body(form)
                        .retrieve()
                        .body(Map.class);
        Object accessToken = response == null ? null : response.get("access_token");
        if (!(accessToken instanceof String token) || token.isBlank()) {
            throw new IllegalStateException("Kitezh token exchange returned no access token");
        }
        return token;
    }

    private String clientCredentialsToken() {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");
        form.add("scope", "admin-api");
        Map<?, ?> response =
                restClient
                        .post()
                        .uri(issuerUri + "/oauth2/token")
                        .headers(headers -> headers.setBasicAuth(clientId, clientSecret))
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body(form)
                        .retrieve()
                        .body(Map.class);
        Object accessToken = response == null ? null : response.get("access_token");
        if (!(accessToken instanceof String token) || token.isBlank()) {
            throw new IllegalStateException("Kitezh token endpoint returned no actor token");
        }
        return token;
    }
}
