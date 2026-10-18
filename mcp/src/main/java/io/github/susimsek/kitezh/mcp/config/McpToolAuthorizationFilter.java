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
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.NullNode;
import tools.jackson.databind.node.ObjectNode;

/** Filters MCP discovery and calls against the authority set in the verified bearer token. */
@RequiredArgsConstructor
final class McpToolAuthorizationFilter extends OncePerRequestFilter {

    private static final int TOOL_NOT_FOUND = -32601;
    private static final int INVALID_REQUEST = -32600;
    private static final String ADMIN = "ROLE_ADMIN";
    private static final String USER_QUERY = "ROLE_USER_QUERY";
    private static final String USER_VIEWER = "ROLE_USER_VIEWER";
    private static final String USER_MANAGER = "ROLE_USER_MANAGER";
    private static final String GROUP_QUERY = "ROLE_GROUP_QUERY";
    private static final String GROUP_VIEWER = "ROLE_GROUP_VIEWER";
    private static final String GROUP_MANAGER = "ROLE_GROUP_MANAGER";
    private static final String CLIENT_QUERY = "ROLE_CLIENT_QUERY";
    private static final String CLIENT_VIEWER = "ROLE_CLIENT_VIEWER";
    private static final String CLIENT_MANAGER = "ROLE_CLIENT_MANAGER";
    private static final String ORGANIZATION_QUERY = "ROLE_ORGANIZATION_QUERY";
    private static final String ORGANIZATION_VIEWER = "ROLE_ORGANIZATION_VIEWER";
    private static final String ORGANIZATION_MANAGER = "ROLE_ORGANIZATION_MANAGER";
    private static final String EVENT_VIEWER = "ROLE_EVENT_VIEWER";
    private static final String EVENT_MANAGER = "ROLE_EVENT_MANAGER";
    private static final Map<String, Set<String>> TOOL_AUTHORITIES = toolAuthorities();

    private final ObjectMapper objectMapper;
    private final McpToolCatalogPolicy catalogPolicy;
    private final McpOperationMetrics operationMetrics;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equalsIgnoreCase(request.getMethod())
                || !"/mcp"
                        .equals(
                                request.getRequestURI()
                                        .substring(request.getContextPath().length()));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        byte[] requestBody = request.getInputStream().readAllBytes();
        JsonNode jsonRequest = readJson(requestBody);
        String method = McpOperationMetrics.methodName(jsonRequest);
        String toolName = McpOperationMetrics.toolName(jsonRequest);
        McpOperationMetrics.Operation operation =
                operationMetrics.start(
                        method,
                        toolName,
                        McpOperationMetrics.protocolVersion(
                                jsonRequest, request.getHeader("MCP-Protocol-Version")));
        String errorType = McpOperationMetrics.noneErrorType();
        try {
            if (jsonRequest != null && jsonRequest.isArray()) {
                writeError(response, NullNode.getInstance(), INVALID_REQUEST, "Invalid request");
                return;
            }

            JsonNode requestId =
                    jsonRequest == null ? NullNode.getInstance() : jsonRequest.path("id");
            if ("tools/call".equals(method) && !canUse(toolName, currentAuthorities())) {
                errorType = "authorization";
                writeError(response, requestId, TOOL_NOT_FOUND, "Tool not found");
                return;
            }

            ContentCachingResponseWrapper wrappedResponse =
                    new ContentCachingResponseWrapper(response);
            filterChain.doFilter(new ReplayableRequest(request, requestBody), wrappedResponse);
            if ("tools/list".equals(method)) {
                byte[] body = wrappedResponse.getContentAsByteArray();
                JsonNode jsonResponse = readJson(body);
                if (jsonResponse instanceof ObjectNode responseObject
                        && responseObject.path("result").path("tools") instanceof ArrayNode tools) {
                    Set<String> authorities = currentAuthorities();
                    ArrayNode visibleTools = objectMapper.createArrayNode();
                    for (JsonNode tool : tools) {
                        if (canUse(text(tool, "name"), authorities)) {
                            visibleTools.add(tool);
                        }
                    }
                    ((ObjectNode) responseObject.path("result")).set("tools", visibleTools);
                    replaceResponse(wrappedResponse, responseObject);
                }
            }
            errorType =
                    operationMetrics.responseErrorType(
                            wrappedResponse.getStatus(), wrappedResponse.getContentAsByteArray());
            wrappedResponse.copyBodyToResponse();
        } catch (IOException | ServletException | RuntimeException exception) {
            errorType = operationMetrics.exceptionErrorType(exception);
            throw exception;
        } finally {
            operationMetrics.record(operation, errorType);
        }
    }

    private boolean canUse(String toolName, Set<String> authorities) {
        if (!catalogPolicy.isEnabled(toolName)) {
            return false;
        }
        if (authorities.contains(ADMIN)) {
            return TOOL_AUTHORITIES.containsKey(toolName);
        }
        Set<String> allowedAuthorities = TOOL_AUTHORITIES.get(toolName);
        return allowedAuthorities != null
                && authorities.stream().anyMatch(allowedAuthorities::contains);
    }

    private static Set<String> currentAuthorities() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return Set.of();
        }
        Set<String> authorities = new LinkedHashSet<>();
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            authorities.add(authority.getAuthority());
        }
        return authorities;
    }

    private JsonNode readJson(byte[] body) {
        try {
            return body.length == 0 ? null : objectMapper.readTree(body);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private static String text(JsonNode node, String fieldName) {
        JsonNode value = node == null ? null : node.get(fieldName);
        return value != null && value.isTextual() ? value.textValue() : "";
    }

    private void replaceResponse(ContentCachingResponseWrapper response, JsonNode body)
            throws IOException {
        byte[] bytes = objectMapper.writeValueAsBytes(body);
        response.resetBuffer();
        response.setContentLength(bytes.length);
        response.getOutputStream().write(bytes);
    }

    private void writeError(
            HttpServletResponse response, JsonNode requestId, int code, String message)
            throws IOException {
        ObjectNode error = objectMapper.createObjectNode();
        error.put("jsonrpc", "2.0");
        error.set("id", requestId);
        error.putObject("error").put("code", code).put("message", message);
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getOutputStream().write(objectMapper.writeValueAsBytes(error));
    }

    private static Map<String, Set<String>> toolAuthorities() {
        Map<String, Set<String>> authorities = new LinkedHashMap<>();
        add(authorities, users(), "search_users", "get_user");
        add(authorities, groups(), "search_groups", "get_group");
        add(
                authorities,
                union(groups(), users()),
                "list_user_groups",
                "list_group_members",
                "get_group_permissions");
        add(authorities, clients(), "search_clients", "get_client");
        add(
                authorities,
                clients(),
                "search_client_scopes",
                "get_client_scope",
                "get_client_scope_assignments",
                "evaluate_client_scopes",
                "search_client_roles",
                "get_client_role",
                "list_client_mappers",
                "list_client_scope_mappers",
                "get_service_account");
        add(
                authorities,
                users(),
                "search_consents",
                "list_user_consents",
                "get_user_consent",
                "list_sessions",
                "list_offline_sessions",
                "list_user_required_actions");
        add(
                authorities,
                Set.of(ADMIN, "ROLE_USER_MANAGER", USER_VIEWER),
                "search_roles",
                "get_role");
        add(authorities, Set.of(ADMIN, EVENT_VIEWER, EVENT_MANAGER), "search_events");
        add(
                authorities,
                organizations(),
                "search_organizations",
                "get_organization",
                "list_organization_members",
                "list_organization_groups",
                "list_organization_domains",
                "list_organization_group_members",
                "list_organization_invitations",
                "list_organization_identity_providers",
                "list_organization_claims");
        add(authorities, Set.of(ADMIN), "get_context");
        add(authorities, Set.of(ADMIN), "get_admin_dashboard_summary");
        add(authorities, Set.of(ADMIN), "list_admin_notifications");
        add(authorities, Set.of(ADMIN), "list_signing_key_metadata");
        return Map.copyOf(authorities);
    }

    private static Set<String> users() {
        return Set.of(ADMIN, USER_QUERY, USER_VIEWER, USER_MANAGER);
    }

    private static Set<String> groups() {
        return Set.of(ADMIN, GROUP_QUERY, GROUP_VIEWER, GROUP_MANAGER, USER_VIEWER, USER_MANAGER);
    }

    private static Set<String> clients() {
        return Set.of(ADMIN, CLIENT_QUERY, CLIENT_VIEWER, CLIENT_MANAGER);
    }

    private static Set<String> organizations() {
        return Set.of(ADMIN, ORGANIZATION_QUERY, ORGANIZATION_VIEWER, ORGANIZATION_MANAGER);
    }

    private static Set<String> union(Set<String> first, Set<String> second) {
        Set<String> union = new LinkedHashSet<>(first);
        union.addAll(second);
        return Set.copyOf(union);
    }

    private static void add(
            Map<String, Set<String>> toolAuthorities, Set<String> roles, String... toolNames) {
        for (String toolName : toolNames) {
            toolAuthorities.put(toolName, roles);
        }
    }

    private static final class ReplayableRequest extends HttpServletRequestWrapper {

        private final byte[] body;

        private ReplayableRequest(HttpServletRequest request, byte[] body) {
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
                    throw new UnsupportedOperationException("Asynchronous reads are unsupported");
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
