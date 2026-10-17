package io.github.susimsek.kitezh.mcp.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KitezhDashboardMcpToolsTest {

    private KitezhAdminApiClient apiClient;
    private SimpleMeterRegistry meterRegistry;
    private KitezhDashboardMcpTools tools;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        meterRegistry = new SimpleMeterRegistry();
        tools = new KitezhDashboardMcpTools(apiClient, meterRegistry);
    }

    @Test
    void returnsAggregateDashboardSummary() {
        Map<String, Object> summary =
                Map.of("clients", 4, "users", 12, "sessions", 6, "consents", 8);
        doReturn(summary).when(apiClient).get(anyString(), anyString(), anyMap());

        assertThat(tools.getAdminDashboardSummary()).isEqualTo(summary);
        verify(apiClient)
                .get("kitezh_get_admin_dashboard_summary", "/api/admin/dashboard", Map.of());
        assertThat(
                        meterRegistry
                                .counter(
                                        "kitezh_mcp_tool_calls_total",
                                        "tool",
                                        "kitezh_get_admin_dashboard_summary",
                                        "status",
                                        "success")
                                .count())
                .isEqualTo(1);
    }

    @Test
    void recordsFailureAndPropagatesApiError() {
        IllegalStateException apiError = new IllegalStateException("API unavailable");
        doThrow(apiError).when(apiClient).get(anyString(), anyString(), anyMap());

        assertThatThrownBy(tools::getAdminDashboardSummary).isSameAs(apiError);
        assertThat(
                        meterRegistry
                                .counter(
                                        "kitezh_mcp_tool_calls_total",
                                        "tool",
                                        "kitezh_get_admin_dashboard_summary",
                                        "status",
                                        "error")
                                .count())
                .isEqualTo(1);
    }
}
