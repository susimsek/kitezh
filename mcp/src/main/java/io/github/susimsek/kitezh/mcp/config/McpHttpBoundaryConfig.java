package io.github.susimsek.kitezh.mcp.config;

import io.github.susimsek.kitezh.mcp.config.http.KitezhApiAuthenticationInterceptor;
import io.github.susimsek.kitezh.mcp.service.client.KitezhAdminApiHttpClient;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

/** Servlet filters for MCP origin policy and cross-origin browser access. */
@Configuration(proxyBeanMethods = false)
class McpHttpBoundaryConfig {

    @Bean
    RestClient kitezhRestClient(RestClient.Builder builder) {
        return builder.requestInterceptor(new KitezhApiAuthenticationInterceptor()).build();
    }

    @Bean
    KitezhAdminApiHttpClient kitezhAdminApiHttpClient(RestClient kitezhRestClient) {
        HttpServiceProxyFactory factory =
                HttpServiceProxyFactory.builderFor(RestClientAdapter.create(kitezhRestClient))
                        .build();
        return factory.createClient(KitezhAdminApiHttpClient.class);
    }

    @Bean
    FilterRegistrationBean<McpRequestBoundaryFilter> mcpRequestBoundaryFilter(
            ApplicationProperties properties) {
        String publicUrl = properties.mcp().publicUrl();
        String configuredOrigins = properties.cors().allowedOrigins();
        McpRequestBoundaryFilter filter =
                new McpRequestBoundaryFilter(publicUrl, configuredOrigins);
        FilterRegistrationBean<McpRequestBoundaryFilter> registration =
                new FilterRegistrationBean<>(filter);
        registration.setName("mcpRequestBoundaryFilter");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 50);
        return registration;
    }

    @Bean
    FilterRegistrationBean<CorsFilter> mcpCorsFilter(ApplicationProperties properties) {
        String publicUrl = properties.mcp().publicUrl();
        String configuredOrigins = properties.cors().allowedOrigins();
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins(publicUrl, configuredOrigins));
        configuration.setAllowedMethods(
                List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(
                List.of(
                        "Authorization",
                        "Content-Type",
                        "Accept",
                        "App-Name",
                        "App-Version",
                        "Client-Platform",
                        "OS",
                        "DPoP",
                        "X-Requested-With",
                        "MCP-Protocol-Version",
                        "MCP-Session-Id",
                        "Last-Event-ID"));
        configuration.setExposedHeaders(
                List.of("DPoP-Nonce", "Location", "MCP-Session-Id", "MCP-Protocol-Version"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        CorsConfigurationSource source = request -> isMcpRequest(request) ? configuration : null;
        FilterRegistrationBean<CorsFilter> registration =
                new FilterRegistrationBean<>(new CorsFilter(source));
        registration.setName("mcpCorsFilter");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 60);
        return registration;
    }

    private static List<String> allowedOrigins(String publicUrl, String configuredOrigins) {
        String publicOrigin = origin(URI.create(publicUrl));
        return java.util.stream.Stream.concat(
                        java.util.stream.Stream.of(publicOrigin),
                        Arrays.stream(configuredOrigins.split(","))
                                .map(String::trim)
                                .filter(origin -> !origin.isEmpty()))
                .distinct()
                .toList();
    }

    private static String origin(URI uri) {
        int port = uri.getPort();
        return uri.getScheme() + "://" + uri.getHost() + (port < 0 ? "" : ":" + port);
    }

    private static boolean isMcpRequest(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return "/mcp".equals(path) || path.startsWith("/mcp/");
    }
}
