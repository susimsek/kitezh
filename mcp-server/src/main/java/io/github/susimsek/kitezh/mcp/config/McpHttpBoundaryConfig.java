package io.github.susimsek.kitezh.mcp.config;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/** Servlet filters for MCP origin policy and cross-origin browser access. */
@Configuration(proxyBeanMethods = false)
class McpHttpBoundaryConfig {

    @Bean
    FilterRegistrationBean<McpRequestBoundaryFilter> mcpRequestBoundaryFilter(
            @Value("${kitezh.mcp.public-url}") String publicUrl,
            @Value("${kitezh.mcp.allowed-origins:}") String configuredOrigins,
            @Value("${kitezh.mcp.allow-local-hosts:false}") boolean allowLocalHosts) {
        McpRequestBoundaryFilter filter =
                new McpRequestBoundaryFilter(publicUrl, configuredOrigins, allowLocalHosts);
        FilterRegistrationBean<McpRequestBoundaryFilter> registration =
                new FilterRegistrationBean<>(filter);
        registration.setName("mcpRequestBoundaryFilter");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 50);
        return registration;
    }

    @Bean
    FilterRegistrationBean<CorsFilter> mcpCorsFilter(
            @Value("${kitezh.mcp.public-url}") String publicUrl,
            @Value("${kitezh.mcp.allowed-origins:}") String configuredOrigins,
            @Value("${kitezh.mcp.allow-local-hosts:false}") boolean allowLocalHosts) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(
                allowedOrigins(publicUrl, configuredOrigins, allowLocalHosts));
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

    private static List<String> allowedOrigins(
            String publicUrl, String configuredOrigins, boolean allowLocalHosts) {
        String publicOrigin = origin(URI.create(publicUrl));
        List<String> origins =
                Arrays.stream(configuredOrigins.split(","))
                        .map(String::trim)
                        .filter(origin -> !origin.isEmpty())
                        .toList();
        List<String> localOrigins =
                allowLocalHosts
                        ? List.of("http://localhost:6274", "http://127.0.0.1:6274")
                        : List.of();
        return java.util.stream.Stream.concat(
                        java.util.stream.Stream.concat(
                                java.util.stream.Stream.of(publicOrigin), origins.stream()),
                        localOrigins.stream())
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
