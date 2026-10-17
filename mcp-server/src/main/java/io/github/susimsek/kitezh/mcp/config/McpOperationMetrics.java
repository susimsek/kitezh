package io.github.susimsek.kitezh.mcp.config;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatusCode;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Records bounded MCP protocol operation metrics for the streamable HTTP transport. */
@RequiredArgsConstructor
final class McpOperationMetrics {

    private static final String METRIC_NAME = "mcp_server_operation_duration_seconds";
    private static final String METHOD_CALL = "tools/call";
    private static final String METHOD_LIST = "tools/list";
    private static final String UNKNOWN = "unknown";
    private static final String NONE = "none";
    private static final String TRANSPORT = "streamable-http";
    private static final String ERROR_TYPE = "error_type";
    private static final String METHOD = "method";
    private static final String TOOL_NAME = "tool_name";
    private static final String TRANSPORT_TAG = "transport";
    private static final String PROTOCOL_VERSION = "protocol_version";
    private static final Set<String> SUPPORTED_METHODS = Set.of(METHOD_CALL, METHOD_LIST);
    private static final Set<String> KNOWN_PROTOCOL_VERSIONS =
            Set.of("2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25");

    private final MeterRegistry meterRegistry;
    private final McpToolCatalogPolicy catalogPolicy;
    private final ObjectMapper objectMapper;

    Operation start(String method, String toolName, String protocolVersion) {
        if (!SUPPORTED_METHODS.contains(method)) {
            return Operation.ignored();
        }
        String boundedToolName =
                METHOD_CALL.equals(method) && catalogPolicy.isKnownTool(toolName)
                        ? toolName
                        : UNKNOWN;
        String boundedProtocolVersion =
                KNOWN_PROTOCOL_VERSIONS.contains(protocolVersion) ? protocolVersion : UNKNOWN;
        return new Operation(method, boundedToolName, boundedProtocolVersion, System.nanoTime());
    }

    void record(Operation operation, String errorType) {
        if (operation.startedAtNanos() < 0) {
            return;
        }
        Timer.Builder timer =
                Timer.builder(METRIC_NAME)
                        .tag(METHOD, operation.method())
                        .tag(ERROR_TYPE, errorType)
                        .tag(TRANSPORT_TAG, TRANSPORT)
                        .tag(PROTOCOL_VERSION, operation.protocolVersion());
        if (METHOD_CALL.equals(operation.method())) {
            timer.tag(TOOL_NAME, operation.toolName());
        }
        timer.register(meterRegistry)
                .record(Duration.ofNanos(System.nanoTime() - operation.startedAtNanos()));
    }

    String responseErrorType(int status, byte[] responseBody) {
        HttpStatusCode statusCode = HttpStatusCode.valueOf(status);
        if (statusCode.is5xxServerError()) {
            return "http_5xx";
        }
        if (statusCode.is4xxClientError()) {
            return "http_4xx";
        }
        JsonNode response = readJson(responseBody);
        if (response == null) {
            return "protocol";
        }
        if (response.has("error") && !response.get("error").isNull()) {
            return "protocol";
        }
        if (response.path("result").path("isError").asBoolean(false)) {
            return "tool";
        }
        return NONE;
    }

    String exceptionErrorType(Throwable exception) {
        if (exception instanceof IllegalArgumentException) {
            return "validation";
        }
        if (exception instanceof java.util.concurrent.TimeoutException) {
            return "timeout";
        }
        return "internal";
    }

    static String methodName(JsonNode request) {
        return text(request, "method");
    }

    static String toolName(JsonNode request) {
        return text(request == null ? null : request.path("params"), "name");
    }

    static String protocolVersion(JsonNode request, String protocolHeader) {
        String headerVersion = protocolHeader == null ? "" : protocolHeader.trim();
        if (!headerVersion.isEmpty()) {
            return headerVersion;
        }
        return text(request == null ? null : request.path("params"), "protocolVersion");
    }

    static String noneErrorType() {
        return NONE;
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

    record Operation(String method, String toolName, String protocolVersion, long startedAtNanos) {

        private static Operation ignored() {
            return new Operation("", "", "", -1);
        }
    }
}
