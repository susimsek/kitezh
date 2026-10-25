package io.github.susimsek.kitezh.mcp.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatRuntimeException;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KitezhServiceAccountMcpToolsTest {

    private KitezhAdminApiClient apiClient;
    private SimpleMeterRegistry meterRegistry;
    private KitezhServiceAccountMcpTools tools;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        meterRegistry = new SimpleMeterRegistry();
        doReturn(Map.of("username", "service-account-demo", "clientRoles", Map.of()))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());
        tools = new KitezhServiceAccountMcpTools(apiClient, meterRegistry);
    }

    @Test
    void readsServiceAccountMetadataAndRoles() {
        assertThat(tools.getServiceAccount("client_1").get("username"))
                .isEqualTo("service-account-demo");
        verify(apiClient)
                .get(
                        "get_service_account",
                        "/api/admin/clients/client_1/service-account",
                        Map.of());
        assertThat(toolCalls("success")).isEqualTo(1);
    }

    @Test
    void rejectsInvalidClientRecordIdBeforeCallingApi() {
        assertThatIllegalArgumentException().isThrownBy(() -> tools.getServiceAccount(null));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.getServiceAccount("../secrets"));
        verifyNoInteractions(apiClient);
    }

    @Test
    void recordsAndRethrowsUpstreamFailure() {
        doThrow(new KitezhAdminApiClient.KitezhApiException("API unavailable"))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());

        assertThatRuntimeException().isThrownBy(() -> tools.getServiceAccount("client_1"));

        assertThat(toolCalls("upstream_error")).isEqualTo(1);
    }

    @Test
    void recordsUnexpectedFailure() {
        doThrow(new IllegalStateException("Unexpected failure"))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());

        assertThatRuntimeException().isThrownBy(() -> tools.getServiceAccount("client_1"));

        assertThat(toolCalls("internal_error")).isEqualTo(1);
    }

    @Test
    void recordsClientFailureFromApiClient() {
        doThrow(new IllegalArgumentException("Invalid request"))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());

        assertThatIllegalArgumentException().isThrownBy(() -> tools.getServiceAccount("client_1"));

        assertThat(toolCalls("client_error")).isEqualTo(1);
    }

    private double toolCalls(String status) {
        return meterRegistry
                .counter(
                        "kitezh_mcp_tool_calls_total",
                        "tool",
                        "get_service_account",
                        "status",
                        status)
                .count();
    }
}
