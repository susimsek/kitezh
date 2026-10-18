package io.github.susimsek.kitezh.mcp.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class McpOperationMetricsTest {

    private static final String METRIC_NAME = "mcp_server_operation_duration_seconds";

    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final McpToolCatalogPolicy catalogPolicy = new McpToolCatalogPolicy("all", "*");
    private final McpOperationMetrics metrics =
            new McpOperationMetrics(meterRegistry, catalogPolicy, new ObjectMapper());

    @Test
    void recordsBoundedToolCallDimensions() {
        McpOperationMetrics.Operation operation =
                metrics.start("tools/call", "kitezh_search_users", "2025-11-25");

        metrics.record(operation, "none");

        assertThat(
                        meterRegistry
                                .find(METRIC_NAME)
                                .tag("method", "tools/call")
                                .tag("tool_name", "kitezh_search_users")
                                .tag("protocol_version", "2025-11-25")
                                .tag("transport", "streamable-http")
                                .tag("error_type", "none")
                                .timer()
                                .count())
                .isEqualTo(1);
    }

    @Test
    void recordsListWithoutToolNameAndBoundsUnknownDimensions() {
        McpOperationMetrics.Operation listOperation = metrics.start("tools/list", "", "2026-10-17");
        McpOperationMetrics.Operation unknownToolOperation =
                metrics.start("tools/call", "unregistered-tool", "2026-10-17");

        metrics.record(listOperation, "none");
        metrics.record(unknownToolOperation, "tool");

        assertThat(
                        meterRegistry
                                .find(METRIC_NAME)
                                .tag("method", "tools/list")
                                .tag("protocol_version", "unknown")
                                .timer()
                                .count())
                .isEqualTo(1);
        assertThat(
                        meterRegistry
                                .find(METRIC_NAME)
                                .tag("method", "tools/call")
                                .tag("tool_name", "unknown")
                                .tag("error_type", "tool")
                                .timer()
                                .count())
                .isEqualTo(1);
    }

    @Test
    void ignoresOtherMcpMethods() {
        metrics.record(metrics.start("initialize", "", "2025-11-25"), "none");

        assertThat(meterRegistry.find(METRIC_NAME).timer()).isNull();
    }

    @Test
    void classifiesHttpJsonRpcAndToolErrors() {
        assertThat(metrics.responseErrorType(503, new byte[0])).isEqualTo("http_5xx");
        assertThat(metrics.responseErrorType(403, new byte[0])).isEqualTo("http_4xx");
        assertThat(
                        metrics.responseErrorType(
                                200,
                                "{\"jsonrpc\":\"2.0\",\"id\":1,\"error\":{\"code\":-32601}}"
                                        .getBytes(StandardCharsets.UTF_8)))
                .isEqualTo("protocol");
        assertThat(
                        metrics.responseErrorType(
                                200,
                                "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"isError\":true}}"
                                        .getBytes(StandardCharsets.UTF_8)))
                .isEqualTo("tool");
        assertThat(
                        metrics.responseErrorType(
                                200,
                                "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}"
                                        .getBytes(StandardCharsets.UTF_8)))
                .isEqualTo("none");
        assertThat(metrics.responseErrorType(200, new byte[0])).isEqualTo("protocol");
    }

    @Test
    void classifiesExceptionsWithoutExposingTheirMessages() {
        assertThat(metrics.exceptionErrorType(new IllegalArgumentException("bad input")))
                .isEqualTo("validation");
        assertThat(metrics.exceptionErrorType(new TimeoutException("secret detail")))
                .isEqualTo("timeout");
        assertThat(metrics.exceptionErrorType(new IllegalStateException("secret detail")))
                .isEqualTo("internal");
    }
}
