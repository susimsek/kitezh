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
import java.util.Locale;
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

    private static final int CAPABILITY_NOT_FOUND = -32601;
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
    private static final Set<String> WRITE_TOOLS =
            Set.of(
                    "preview_set_user_enabled",
                    "apply_set_user_enabled",
                    "preview_add_user_to_group",
                    "apply_add_user_to_group",
                    "preview_remove_user_from_group",
                    "apply_remove_user_from_group",
                    "preview_revoke_session",
                    "apply_revoke_session");
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
                writeError(response, requestId, CAPABILITY_NOT_FOUND, "Tool not found");
                return;
            }
            if (!canUseRequest(method, jsonRequest, currentAuthorities())) {
                errorType = "authorization";
                writeError(response, requestId, CAPABILITY_NOT_FOUND, "Capability not found");
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
            filterCapabilityDiscovery(method, jsonRequest, wrappedResponse, currentAuthorities());
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
        if (WRITE_TOOLS.contains(toolName)) {
            if (!authorities.contains("SCOPE_mcp.write")) {
                return false;
            }
        } else if (!authorities.contains("SCOPE_mcp.read")
                && !authorities.contains("SCOPE_mcp.write")) {
            return false;
        }
        if (authorities.contains(ADMIN)) {
            return TOOL_AUTHORITIES.containsKey(toolName);
        }
        Set<String> allowedAuthorities = TOOL_AUTHORITIES.get(toolName);
        return allowedAuthorities != null
                && authorities.stream().anyMatch(allowedAuthorities::contains);
    }

    private boolean canUseRequest(String method, JsonNode request, Set<String> authorities) {
        JsonNode params = request == null ? null : request.path("params");
        return switch (method) {
            case "resources/read" -> canUse(resourceTool(text(params, "uri")), authorities);
            case "prompts/get" -> canGetPrompt(params, authorities);
            case "completion/complete" -> canCompleteRequest(params, authorities);
            default -> true;
        };
    }

    private boolean canCompleteRequest(JsonNode params, Set<String> authorities) {
        JsonNode reference = params == null ? null : params.path("ref");
        if ("ref/resource".equals(text(reference, "type"))) {
            return canCompleteResource(text(reference, "uri"), authorities);
        }
        return canComplete(text(reference, "name"), authorities);
    }

    private void filterCapabilityDiscovery(
            String method,
            JsonNode request,
            ContentCachingResponseWrapper response,
            Set<String> authorities)
            throws IOException {
        if (!("resources/templates/list".equals(method)
                || "prompts/list".equals(method)
                || "completion/complete".equals(method))) {
            return;
        }
        JsonNode jsonResponse = readJson(response.getContentAsByteArray());
        if (!(jsonResponse instanceof ObjectNode responseObject)
                || !(responseObject.path("result") instanceof ObjectNode result)) {
            return;
        }
        if ("completion/complete".equals(method)) {
            filterCompletionValues(request, result, authorities);
            replaceResponse(response, responseObject);
            return;
        }
        String collection =
                "resources/templates/list".equals(method) ? "resourceTemplates" : "prompts";
        if (!(result.path(collection) instanceof ArrayNode entries)) {
            return;
        }
        ArrayNode visibleEntries = objectMapper.createArrayNode();
        for (JsonNode entry : entries) {
            boolean visible =
                    "prompts/list".equals(method)
                            ? "review_resource".equals(text(entry, "name"))
                                    && canReadAnyResource(authorities)
                            : canUse(resourceTool(text(entry, "uriTemplate")), authorities);
            if (visible) {
                visibleEntries.add(entry);
            }
        }
        result.set(collection, visibleEntries);
        replaceResponse(response, responseObject);
    }

    private boolean canComplete(String promptName, Set<String> authorities) {
        return "review_resource".equals(promptName) && canReadAnyResource(authorities);
    }

    private boolean canGetPrompt(JsonNode params, Set<String> authorities) {
        if (!"review_resource".equals(text(params, "name"))) {
            return false;
        }
        JsonNode arguments = params == null ? null : params.path("arguments");
        String resourceType = text(arguments, "resourceType");
        if (resourceType.isEmpty()) {
            return canReadAnyResource(authorities);
        }
        return canUse(
                resourceTool("kitezh://" + resourceType.toLowerCase(Locale.ROOT) + "/"),
                authorities);
    }

    private void filterCompletionValues(
            JsonNode request, ObjectNode result, Set<String> authorities) {
        JsonNode completion = result.path("completion");
        if (!(completion instanceof ObjectNode completionObject)
                || !(completionObject.path("values") instanceof ArrayNode values)) {
            return;
        }
        JsonNode reference = request == null ? null : request.path("params").path("ref");
        if ("ref/resource".equals(text(reference, "type"))) {
            if (!canCompleteResource(text(reference, "uri"), authorities)) {
                completionObject.set("values", objectMapper.createArrayNode());
                completionObject.put("total", 0);
            }
            return;
        }
        ArrayNode visibleValues = objectMapper.createArrayNode();
        for (JsonNode value : values) {
            if (!value.isTextual()
                    || canUse(resourceTool("kitezh://" + value.textValue() + "/"), authorities)) {
                visibleValues.add(value);
            }
        }
        completionObject.set("values", visibleValues);
        if (completionObject.has("total")) {
            completionObject.put("total", visibleValues.size());
        }
    }

    private boolean canReadAnyResource(Set<String> authorities) {
        return canUse("get_user", authorities)
                || canUse("get_group", authorities)
                || canUse("get_client", authorities);
    }

    private boolean canCompleteResource(String uri, Set<String> authorities) {
        String readTool = resourceTool(uri);
        String searchTool = resourceSearchTool(uri);
        return !readTool.isEmpty()
                && !searchTool.isEmpty()
                && canUse(readTool, authorities)
                && canUse(searchTool, authorities);
    }

    private static String resourceTool(String uri) {
        if (uri == null) {
            return "";
        }
        if (uri.startsWith("kitezh://users/")) {
            return "get_user";
        }
        if (uri.startsWith("kitezh://groups/")) {
            return "get_group";
        }
        if (uri.startsWith("kitezh://clients/")) {
            return "get_client";
        }
        return "";
    }

    private static String resourceSearchTool(String uri) {
        if (uri == null) {
            return "";
        }
        if (uri.startsWith("kitezh://users/")) {
            return "search_users";
        }
        if (uri.startsWith("kitezh://groups/")) {
            return "search_groups";
        }
        if (uri.startsWith("kitezh://clients/")) {
            return "search_clients";
        }
        return "";
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
        add(authorities, users(), "preview_set_user_enabled", "apply_set_user_enabled");
        add(
                authorities,
                Set.of(ADMIN, USER_MANAGER, GROUP_MANAGER),
                "preview_add_user_to_group",
                "apply_add_user_to_group",
                "preview_remove_user_from_group",
                "apply_remove_user_from_group");
        add(
                authorities,
                Set.of(ADMIN, USER_MANAGER),
                "preview_revoke_session",
                "apply_revoke_session");
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
