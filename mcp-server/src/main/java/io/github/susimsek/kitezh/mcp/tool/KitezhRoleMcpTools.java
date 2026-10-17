package io.github.susimsek.kitezh.mcp.tool;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class KitezhRoleMcpTools {

    private static final String ROLE_NAME_PATTERN = "ROLE_[A-Z0-9_]{1,45}";
    private static final String CLIENT_ID_PATTERN = "[A-Za-z0-9._:-]{1,100}";
    private static final int MAX_SEARCH_LENGTH = 256;

    private final KitezhAdminApiClient apiClient;
    private final MeterRegistry meterRegistry;

    @McpTool(
            name = "kitezh_search_roles",
            description = "Search realm roles with bounded pagination.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Search realm roles",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> searchRoles(
            @McpToolParam(description = "Optional role-name search text.", required = false)
                    String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        McpPage paging = McpPage.validated(defaultValue(page, 0), defaultValue(size, 20));
        Map<String, Object> parameters = pageParameters(paging, "name,asc", q);
        return measured(
                "kitezh_search_roles",
                () -> apiClient.get("kitezh_search_roles", "/api/admin/roles", parameters));
    }

    @McpTool(
            name = "kitezh_get_role",
            description = "Get a realm role and its paged user/composite-role summary.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Get realm role",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> getRole(
            @McpToolParam(description = "Realm role name, such as ROLE_USER.") String name,
            @McpToolParam(description = "Optional username or name search text.", required = false)
                    String q,
            @McpToolParam(description = "Optional user enabled-state filter.", required = false)
                    Boolean enabled,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        String roleName = validatePathComponent(name, ROLE_NAME_PATTERN, "name");
        McpPage paging = McpPage.validated(defaultValue(page, 0), defaultValue(size, 20));
        Map<String, Object> parameters = pageParameters(paging, "username,asc", q);
        if (enabled != null) {
            parameters.put("enabled", enabled);
        }
        return measured(
                "kitezh_get_role",
                () -> apiClient.get("kitezh_get_role", "/api/admin/roles/" + roleName, parameters));
    }

    @McpTool(
            name = "kitezh_search_client_roles",
            description = "Search roles owned by one OAuth client with bounded pagination.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Search client roles",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> searchClientRoles(
            @McpToolParam(description = "OAuth client identifier.") String clientId,
            @McpToolParam(description = "Optional role-name search text.", required = false)
                    String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        String validatedClientId = validatePathComponent(clientId, CLIENT_ID_PATTERN, "clientId");
        McpPage paging = McpPage.validated(defaultValue(page, 0), defaultValue(size, 20));
        Map<String, Object> parameters = pageParameters(paging, "name,asc", q);
        return measured(
                "kitezh_search_client_roles",
                () ->
                        apiClient.get(
                                "kitezh_search_client_roles",
                                "/api/admin/clients/" + validatedClientId + "/roles",
                                parameters));
    }

    @McpTool(
            name = "kitezh_get_client_role",
            description = "Get a client role and its paged users, groups, and composite roles.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Get client role",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> getClientRole(
            @McpToolParam(description = "OAuth client identifier.") String clientId,
            @McpToolParam(description = "Internal client-role identifier.") Long roleId,
            @McpToolParam(description = "Optional username or name search text.", required = false)
                    String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        String validatedClientId = validatePathComponent(clientId, CLIENT_ID_PATTERN, "clientId");
        McpPage paging = McpPage.validated(defaultValue(page, 0), defaultValue(size, 20));
        Map<String, Object> parameters = pageParameters(paging, "username,asc", q);
        return measured(
                "kitezh_get_client_role",
                () ->
                        apiClient.get(
                                "kitezh_get_client_role",
                                "/api/admin/clients/"
                                        + validatedClientId
                                        + "/roles/"
                                        + positiveId(roleId),
                                parameters));
    }

    @McpTool(
            name = "kitezh_list_group_members",
            description = "List members of a group with bounded pagination.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List group members",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> listGroupMembers(
            @McpToolParam(description = "Internal Kitezh group ID.") Long groupId,
            @McpToolParam(description = "Optional username search text.", required = false)
                    String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        McpPage paging = McpPage.validated(defaultValue(page, 0), defaultValue(size, 20));
        Map<String, Object> parameters = pageParameters(paging, "username,asc", q);
        return measured(
                "kitezh_list_group_members",
                () ->
                        apiClient.get(
                                "kitezh_list_group_members",
                                "/api/admin/groups/" + positiveId(groupId) + "/users",
                                parameters));
    }

    @McpTool(
            name = "kitezh_get_group_permissions",
            description = "List administrator permission assignments for a group.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Get group permissions",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public List<Map<String, Object>> getGroupPermissions(
            @McpToolParam(description = "Internal Kitezh group ID.") Long groupId) {
        return measured(
                "kitezh_get_group_permissions",
                () ->
                        apiClient.getList(
                                "kitezh_get_group_permissions",
                                "/api/admin/groups/" + positiveId(groupId) + "/permissions",
                                Map.of()));
    }

    private static Map<String, Object> pageParameters(McpPage page, String sort, String q) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("page", page.page());
        parameters.put("size", page.size());
        parameters.put("sort", sort);
        String validatedQuery = validateSearch(q);
        if (validatedQuery != null) {
            parameters.put("q", validatedQuery);
        }
        return parameters;
    }

    private <T> T measured(String tool, Supplier<T> operation) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String status = "success";
        try {
            return operation.get();
        } catch (RuntimeException exception) {
            status = exception instanceof IllegalArgumentException ? "client_error" : "error";
            throw exception;
        } finally {
            meterRegistry
                    .counter("kitezh_mcp_tool_calls_total", "tool", tool, "status", status)
                    .increment();
            sample.stop(
                    Timer.builder("kitezh_mcp_tool_call_duration_seconds")
                            .tag("tool", tool)
                            .register(meterRegistry));
        }
    }

    private static String validateSearch(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.length() > MAX_SEARCH_LENGTH || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("q must be at most 256 printable characters");
        }
        return value;
    }

    private static long positiveId(Long value) {
        if (value == null || value < 1) {
            throw new IllegalArgumentException("The identifier must be a positive integer");
        }
        return value;
    }

    private static int defaultValue(Integer value, int defaultValue) {
        return value == null ? defaultValue : value;
    }

    private static String validatePathComponent(String value, String pattern, String field) {
        if (value == null || !value.matches(pattern)) {
            throw new IllegalArgumentException(field + " is invalid");
        }
        return value;
    }
}
