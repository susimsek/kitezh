package io.github.susimsek.kitezh.mcp.tool;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class KitezhMcpTools {

    private final KitezhAdminApiClient apiClient;
    private final MeterRegistry meterRegistry;

    @McpTool(
            name = "kitezh_get_context",
            description = "Get the current operator and Kitezh access summary.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Kitezh access context",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> getContext() {
        return measured(
                "kitezh_get_context",
                () -> apiClient.get("kitezh_get_context", "/api/admin/whoami", Map.of()));
    }

    @McpTool(
            name = "kitezh_search_users",
            description = "Search Kitezh users with bounded pagination.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Search users",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> searchUsers(
            @McpToolParam(description = "Username, email, or name search text.", required = false)
                    String q,
            @McpToolParam(description = "Optional enabled-state filter.", required = false)
                    Boolean enabled,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        return paged(
                "kitezh_search_users", "/api/admin/users", q, enabled, page, size, "username,asc");
    }

    @McpTool(
            name = "kitezh_get_user",
            description = "Get a user summary without credentials or password data.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Get user",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> getUser(@McpToolParam(description = "Internal Kitezh user ID.") Long userId) {
        return measured(
                "kitezh_get_user",
                () ->
                        apiClient.get(
                                "kitezh_get_user",
                                "/api/admin/users/" + positiveId(userId),
                                Map.of()));
    }

    @McpTool(
            name = "kitezh_list_user_groups",
            description = "List the groups assigned to a user.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List user groups",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> listUserGroups(
            @McpToolParam(description = "Internal Kitezh user ID.") Long userId,
            @McpToolParam(description = "Optional group-name search text.", required = false)
                    String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        McpPage paging = McpPage.validated(defaultValue(page, 0), defaultValue(size, 20));
        return measured(
                "kitezh_list_user_groups",
                () ->
                        apiClient.get(
                                "kitezh_list_user_groups",
                                "/api/admin/users/" + positiveId(userId) + "/groups",
                                pageParameters(paging, "name,asc", q, null)));
    }

    @McpTool(
            name = "kitezh_search_groups",
            description = "Search Kitezh groups with bounded pagination.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Search groups",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> searchGroups(
            @McpToolParam(description = "Optional group-name search text.", required = false)
                    String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        return paged("kitezh_search_groups", "/api/admin/groups", q, null, page, size, "name,asc");
    }

    @McpTool(
            name = "kitezh_get_group",
            description = "Get a group summary and its safe role information.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Get group",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> getGroup(
            @McpToolParam(description = "Internal Kitezh group ID.") Long groupId) {
        return measured(
                "kitezh_get_group",
                () ->
                        apiClient.get(
                                "kitezh_get_group",
                                "/api/admin/groups/" + positiveId(groupId),
                                Map.of()));
    }

    @McpTool(
            name = "kitezh_search_clients",
            description = "Search registered Kitezh OAuth clients without secrets.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Search OAuth clients",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> searchClients(
            @McpToolParam(description = "Optional client ID or name search text.", required = false)
                    String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        return paged(
                "kitezh_search_clients", "/api/admin/clients", q, null, page, size, "clientId,asc");
    }

    @McpTool(
            name = "kitezh_get_client",
            description = "Get a registered client configuration without secrets or hashes.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Get OAuth client",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> getClient(
            @McpToolParam(description = "Internal registered-client ID.") String clientRecordId) {
        if (clientRecordId == null || clientRecordId.isBlank() || clientRecordId.contains("/")) {
            throw new IllegalArgumentException("clientRecordId is required");
        }
        return measured(
                "kitezh_get_client",
                () ->
                        apiClient.get(
                                "kitezh_get_client",
                                "/api/admin/clients/" + clientRecordId,
                                Map.of()));
    }

    @McpTool(
            name = "kitezh_list_sessions",
            description = "Search browser-session metadata. Tokens are never returned.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List sessions",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> listSessions(
            @McpToolParam(
                            description = "Optional username or session search text.",
                            required = false)
                    String q,
            @McpToolParam(description = "Optional registered client ID.", required = false)
                    String clientId,
            @McpToolParam(description = "Session state: active or expired.", required = false)
                    String status,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        McpPage paging = McpPage.validated(defaultValue(page, 0), defaultValue(size, 20));
        Map<String, Object> parameters = pageParameters(paging, "lastAccessTime,desc", q, null);
        addOptional(parameters, "clientId", blankToNull(clientId));
        parameters.put("status", status == null || status.isBlank() ? "active" : status);
        return measured(
                "kitezh_list_sessions",
                () -> apiClient.get("kitezh_list_sessions", "/api/admin/sessions", parameters));
    }

    @McpTool(
            name = "kitezh_search_events",
            description = "Search administrative audit events with bounded pagination.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Search audit events",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> searchEvents(
            @McpToolParam(description = "Actor or target search text.", required = false) String q,
            @McpToolParam(description = "Event action filter.", required = false) String action,
            @McpToolParam(description = "Target resource type.", required = false)
                    String targetType,
            @McpToolParam(description = "Target resource ID.", required = false) String targetId,
            @McpToolParam(description = "Inclusive ISO-8601 start time.", required = false)
                    String from,
            @McpToolParam(description = "Inclusive ISO-8601 end time.", required = false) String to,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        McpPage paging = McpPage.validated(defaultValue(page, 0), defaultValue(size, 20));
        validateTimeRange(from, to);
        Map<String, Object> parameters = pageParameters(paging, "occurredAt,desc", q, null);
        addOptional(parameters, "action", blankToNull(action));
        addOptional(parameters, "targetType", blankToNull(targetType));
        addOptional(parameters, "targetId", blankToNull(targetId));
        addOptional(parameters, "from", blankToNull(from));
        addOptional(parameters, "to", blankToNull(to));
        return measured(
                "kitezh_search_events",
                () -> apiClient.get("kitezh_search_events", "/api/admin/events", parameters));
    }

    private Map<?, ?> paged(
            String tool,
            String path,
            String q,
            Boolean enabled,
            Integer page,
            Integer size,
            String sort) {
        McpPage paging = McpPage.validated(defaultValue(page, 0), defaultValue(size, 20));
        Map<String, Object> parameters = pageParameters(paging, sort, q, enabled);
        return measured(tool, () -> apiClient.get(tool, path, parameters));
    }

    private Map<?, ?> measured(String tool, Supplier<Map<?, ?>> operation) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String status = "success";
        try {
            return operation.get();
        } catch (RuntimeException exception) {
            status =
                    exception instanceof IllegalArgumentException
                            ? "client_error"
                            : exception instanceof KitezhAdminApiClient.KitezhApiException
                                    ? "upstream_error"
                                    : "internal_error";
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

    private static Map<String, Object> pageParameters(
            McpPage page, String sort, String q, Boolean enabled) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("page", page.page());
        parameters.put("size", page.size());
        parameters.put("sort", sort);
        addOptional(parameters, "q", blankToNull(q));
        if (enabled != null) {
            parameters.put("enabled", enabled);
        }
        return parameters;
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

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static void addOptional(Map<String, Object> parameters, String name, Object value) {
        if (value != null) {
            parameters.put(name, value);
        }
    }

    private static void validateTimeRange(String from, String to) {
        Instant start = parseInstant(from);
        Instant end = parseInstant(to);
        if (start != null && end != null && start.isAfter(end)) {
            throw new IllegalArgumentException("from must be before or equal to to");
        }
    }

    private static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (java.time.format.DateTimeParseException exception) {
            throw new IllegalArgumentException(
                    "Event timestamps must use ISO-8601 format", exception);
        }
    }
}
