package io.github.susimsek.kitezh.mcp.config.http;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient.KitezhApiException;
import java.io.IOException;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/** Forwards the authenticated MCP caller's access token to the Admin API. */
public final class KitezhApiAuthenticationInterceptor implements ClientHttpRequestInterceptor {

    @Override
    public ClientHttpResponse intercept(
            HttpRequest request, byte[] body, ClientHttpRequestExecution execution)
            throws IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            throw new KitezhApiException("An authenticated Kitezh user is required");
        }
        request.getHeaders().setBearerAuth(jwt.getTokenValue());
        return execution.execute(request, body);
    }
}
