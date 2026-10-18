package io.github.susimsek.kitezh.mcp.tool;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class KitezhOrganizationMcpTools {

    private static final Set<String> SENSITIVE_FIELDS =
            Set.of("email", "token", "verificationtoken");

    private final KitezhAdminApiClient apiClient;
    private final MeterRegistry meterRegistry;

    @McpTool(
            name = "search_organizations",
            description = "Search Kitezh organizations with bounded pagination.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Search organizations",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> searchOrganizations(
            @McpToolParam(
                            description = "Optional organization alias or name search.",
                            required = false)
                    String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        return paged("search_organizations", "/api/admin/organizations", q, page, size, "name,asc");
    }

    @McpTool(
            name = "get_organization",
            description = "Get safe metadata and counts for one Kitezh organization.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Get organization",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> getOrganization(
            @McpToolParam(description = "Internal Kitezh organization ID.") Long organizationId) {
        return measured(
                "get_organization",
                () ->
                        sanitize(
                                apiClient.get(
                                        "get_organization",
                                        "/api/admin/organizations/" + positiveId(organizationId),
                                        Map.of())));
    }

    @McpTool(
            name = "list_organization_members",
            description = "List organization membership metadata without member email addresses.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List organization members",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> listOrganizationMembers(
            @McpToolParam(description = "Internal Kitezh organization ID.") Long organizationId,
            @McpToolParam(description = "Optional username search.", required = false) String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        return organizationPage(
                "list_organization_members",
                "/api/admin/organizations/" + positiveId(organizationId) + "/members",
                q,
                page,
                size,
                "user.username,asc");
    }

    @McpTool(
            name = "list_organization_groups",
            description = "List organization-scoped groups with bounded pagination.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List organization groups",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> listOrganizationGroups(
            @McpToolParam(description = "Internal Kitezh organization ID.") Long organizationId,
            @McpToolParam(description = "Optional group-name search.", required = false) String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        return organizationPage(
                "list_organization_groups",
                "/api/admin/organizations/" + positiveId(organizationId) + "/groups",
                q,
                page,
                size,
                "name,asc");
    }

    @McpTool(
            name = "list_organization_domains",
            description = "List organization domains without DNS verification secrets.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List organization domains",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> listOrganizationDomains(
            @McpToolParam(description = "Internal Kitezh organization ID.") Long organizationId) {
        return measured(
                "list_organization_domains",
                () -> {
                    List<Map<String, Object>> domains =
                            apiClient.getList(
                                    "list_organization_domains",
                                    "/api/admin/organizations/"
                                            + positiveId(organizationId)
                                            + "/domains",
                                    Map.of());
                    return Map.of("domains", sanitizeList(domains));
                });
    }

    @McpTool(
            name = "list_organization_group_members",
            description = "List membership metadata for a group inside an organization.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List organization group members",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> listOrganizationGroupMembers(
            @McpToolParam(description = "Internal Kitezh organization ID.") Long organizationId,
            @McpToolParam(description = "Internal Kitezh organization group ID.") Long groupId,
            @McpToolParam(description = "Optional username search.", required = false) String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        return organizationPage(
                "list_organization_group_members",
                "/api/admin/organizations/"
                        + positiveId(organizationId)
                        + "/groups/"
                        + positiveId(groupId)
                        + "/members",
                q,
                page,
                size,
                "user.username,asc");
    }

    @McpTool(
            name = "list_organization_invitations",
            description =
                    "List organization invitation status metadata without invitee emails or tokens.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List organization invitations",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> listOrganizationInvitations(
            @McpToolParam(description = "Internal Kitezh organization ID.") Long organizationId,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        return organizationPage(
                "list_organization_invitations",
                "/api/admin/organizations/" + positiveId(organizationId) + "/invitations",
                null,
                page,
                size,
                "createdAt,desc");
    }

    private Map<?, ?> paged(
            String tool, String path, String q, Integer page, Integer size, String sort) {
        validateSearch(q);
        McpPage paging = McpPage.validated(defaultValue(page, 0), defaultValue(size, 20));
        Map<String, Object> parameters = pageParameters(paging, sort, q);
        return measured(tool, () -> sanitize(apiClient.get(tool, path, parameters)));
    }

    private Map<?, ?> organizationPage(
            String tool, String path, String q, Integer page, Integer size, String sort) {
        return paged(tool, path, q, page, size, sort);
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

    private static Map<String, Object> pageParameters(McpPage page, String sort, String q) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("page", page.page());
        parameters.put("size", page.size());
        parameters.put("sort", sort);
        if (q != null && !q.isBlank()) {
            parameters.put("q", q);
        }
        return parameters;
    }

    private static long positiveId(Long value) {
        if (value == null || value < 1) {
            throw new IllegalArgumentException("The identifier must be a positive integer");
        }
        return value;
    }

    private static void validateSearch(String query) {
        if (query != null && query.length() > 256) {
            throw new IllegalArgumentException("Search text must be 256 characters or fewer");
        }
    }

    private static int defaultValue(Integer value, int defaultValue) {
        return value == null ? defaultValue : value;
    }

    private static Map<?, ?> sanitize(Map<?, ?> value) {
        return (Map<?, ?>) sanitizeValue(value);
    }

    private static Object sanitizeValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<Object, Object> safeMap = new LinkedHashMap<>();
            map.forEach(
                    (key, nestedValue) -> {
                        if (!(key instanceof String field)
                                || !SENSITIVE_FIELDS.contains(field.toLowerCase(Locale.ROOT))) {
                            safeMap.put(key, sanitizeValue(nestedValue));
                        }
                    });
            return safeMap;
        }
        if (value instanceof List<?> list) {
            return sanitizeList(list);
        }
        return value;
    }

    private static List<?> sanitizeList(List<?> values) {
        return values.stream().map(KitezhOrganizationMcpTools::sanitizeValue).toList();
    }
}
