package io.github.susimsek.kitezh.mcp.tool;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

/** Read-only access to the authenticated administrator's privacy-safe notification feed. */
@Component
public class KitezhAdminNotificationMcpTools {

    private final KitezhAdminApiClient apiClient;
    private final MeterRegistry meterRegistry;

    public KitezhAdminNotificationMcpTools(
            KitezhAdminApiClient apiClient, MeterRegistry meterRegistry) {
        this.apiClient = apiClient;
        this.meterRegistry = meterRegistry;
    }

    @McpTool(
            name = "kitezh_list_admin_notifications",
            description =
                    "List the current administrator's privacy-safe notification feed with bounded pagination.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List admin notifications",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> listAdminNotifications(
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        McpPage paging = McpPage.validated(page == null ? 0 : page, size == null ? 20 : size);
        return measured(
                "kitezh_list_admin_notifications",
                () ->
                        apiClient.get(
                                "kitezh_list_admin_notifications",
                                "/api/admin/notifications",
                                Map.of(
                                        "page",
                                        paging.page(),
                                        "size",
                                        paging.size(),
                                        "sort",
                                        "createdAt,desc")));
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
}
