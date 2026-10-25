package io.github.susimsek.kitezh.mcp.tool;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.Map;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

/** Read-only service-account metadata and effective-role inspection tool. */
@Component
@RequiredArgsConstructor
public class KitezhServiceAccountMcpTools {

    private static final String CLIENT_RECORD_ID_PATTERN = "[A-Za-z0-9._~-]{1,128}";
    private static final String TOOL_NAME = "get_service_account";

    private final KitezhAdminApiClient apiClient;
    private final MeterRegistry meterRegistry;

    @McpTool(
            name = TOOL_NAME,
            description =
                    "Get a registered OAuth client's service-account username and effective"
                            + " application and client roles. No credentials or tokens are returned.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Get service-account roles",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> getServiceAccount(
            @McpToolParam(description = "Internal registered-client record ID.")
                    String clientRecordId) {
        String clientId = validateClientRecordId(clientRecordId);
        return measured(
                () ->
                        apiClient.get(
                                TOOL_NAME,
                                "/api/admin/clients/" + clientId + "/service-account",
                                Map.of()));
    }

    private Map<?, ?> measured(Supplier<Map<?, ?>> operation) {
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
                    .counter("kitezh_mcp_tool_calls_total", "tool", TOOL_NAME, "status", status)
                    .increment();
            sample.stop(
                    Timer.builder("kitezh_mcp_tool_call_duration_seconds")
                            .tag("tool", TOOL_NAME)
                            .register(meterRegistry));
        }
    }

    private static String validateClientRecordId(String value) {
        if (value == null
                || !value.matches(CLIENT_RECORD_ID_PATTERN)
                || value.equals(".")
                || value.equals("..")) {
            throw new IllegalArgumentException("clientRecordId has an invalid format");
        }
        return value;
    }
}
