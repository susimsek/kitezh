package io.github.susimsek.kitezh.mcp.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

/** Rejects untrusted host/origin values and bounds MCP request bodies. */
class McpRequestBoundaryFilter extends OncePerRequestFilter {

    private static final int MAX_REQUEST_BODY_BYTES = 1_048_576;
    private static final Set<String> LOCAL_HOSTS = Set.of("localhost", "127.0.0.1", "::1");

    private final Set<String> allowedHosts;
    private final Set<String> allowedOrigins;
    private final boolean allowLocalHosts;

    McpRequestBoundaryFilter(String publicUrl, String configuredOrigins, boolean allowLocalHosts) {
        URI publicUri = URI.create(publicUrl);
        if (!("http".equals(publicUri.getScheme()) || "https".equals(publicUri.getScheme()))
                || publicUri.getHost() == null
                || publicUri.getUserInfo() != null) {
            throw new IllegalArgumentException("MCP public URL must be an absolute HTTP URL");
        }
        this.allowedHosts = Set.of(publicUri.getHost().toLowerCase(Locale.ROOT));
        this.allowedOrigins = allowedOrigins(publicUri, configuredOrigins, allowLocalHosts);
        this.allowLocalHosts = allowLocalHosts;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String host = request.getServerName().toLowerCase(Locale.ROOT);
        if (!allowedHosts.contains(host) && !(allowLocalHosts && LOCAL_HOSTS.contains(host))) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST);
            return;
        }

        String origin = request.getHeader("Origin");
        if (origin != null && !allowedOrigins.contains(origin)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN);
            return;
        }

        if ("/mcp".equals(request.getRequestURI().substring(request.getContextPath().length()))) {
            HttpServletRequest boundedRequest = boundedRequest(request, response);
            if (boundedRequest == null) {
                return;
            }
            filterChain.doFilter(boundedRequest, response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private static HttpServletRequest boundedRequest(
            HttpServletRequest request, HttpServletResponse response) throws IOException {
        if (request.getContentLengthLong() > MAX_REQUEST_BODY_BYTES) {
            response.sendError(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
            return null;
        }
        if ("GET".equals(request.getMethod()) || "HEAD".equals(request.getMethod())) {
            return request;
        }
        byte[] body = request.getInputStream().readNBytes(MAX_REQUEST_BODY_BYTES + 1);
        if (body.length > MAX_REQUEST_BODY_BYTES) {
            response.sendError(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
            return null;
        }
        return new ReplayableBodyRequest(request, body);
    }

    private static Set<String> allowedOrigins(
            URI publicUri, String configuredOrigins, boolean allowLocalHosts) {
        Set<String> origins = new HashSet<>();
        origins.add(origin(publicUri));
        Arrays.stream(configuredOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .forEach(origins::add);
        if (allowLocalHosts) {
            origins.add("http://localhost:6274");
            origins.add("http://127.0.0.1:6274");
        }
        return Set.copyOf(origins);
    }

    private static String origin(URI uri) {
        int port = uri.getPort();
        return uri.getScheme() + "://" + uri.getHost() + (port < 0 ? "" : ":" + port);
    }

    private static final class ReplayableBodyRequest extends HttpServletRequestWrapper {

        private final byte[] body;

        ReplayableBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public int read() {
                    return input.read();
                }

                @Override
                public boolean isFinished() {
                    return input.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener readListener) {
                    throw new UnsupportedOperationException("Non-blocking reads are not supported");
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(
                    new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
        }
    }
}
