package io.github.susimsek.kitezh.mcp.tool;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class KitezhUserSecurityMcpTools {

    private final KitezhAdminApiClient apiClient;
    private final MeterRegistry meterRegistry;

    @McpTool(
            name = "kitezh_list_user_required_actions",
            description = "List required-action assignments for a manageable Kitezh user.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List user required actions",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public List<Map<String, Object>> listUserRequiredActions(
            @McpToolParam(description = "Internal Kitezh user ID.") Long userId) {
        long validatedId = positiveId(userId);
        return measured(
                "kitezh_list_user_required_actions",
                () ->
                        apiClient.getList(
                                "kitezh_list_user_required_actions",
                                "/api/admin/required-actions/users/" + validatedId,
                                Map.of()));
    }

    @McpTool(
            name = "kitezh_list_offline_sessions",
            description =
                    "List offline session metadata with bounded pagination; tokens are omitted.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List offline sessions",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> listOfflineSessions(
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        McpPage paging = McpPage.validated(page == null ? 0 : page, size == null ? 20 : size);
        return measured(
                "kitezh_list_offline_sessions",
                () ->
                        apiClient.get(
                                "kitezh_list_offline_sessions",
                                "/api/admin/offline-sessions",
                                Map.of(
                                        "page",
                                        paging.page(),
                                        "size",
                                        paging.size(),
                                        "sort",
                                        "refreshTokenIssuedAt,desc")));
    }

    private <T> T measured(String tool, java.util.function.Supplier<T> operation) {
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

    private static long positiveId(Long value) {
        if (value == null || value < 1) {
            throw new IllegalArgumentException("The identifier must be a positive integer");
        }
        return value;
    }
}
