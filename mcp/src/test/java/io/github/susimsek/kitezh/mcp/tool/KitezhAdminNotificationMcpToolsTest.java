package io.github.susimsek.kitezh.mcp.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;
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

class KitezhAdminNotificationMcpToolsTest {

    private KitezhAdminApiClient apiClient;
    private SimpleMeterRegistry meterRegistry;
    private KitezhAdminNotificationMcpTools tools;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        meterRegistry = new SimpleMeterRegistry();
        doReturn(Map.of("content", java.util.List.of()))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());
        tools = new KitezhAdminNotificationMcpTools(apiClient, meterRegistry);
    }

    @Test
    void listsNotificationsWithBoundedPagination() {
        assertThat(tools.listAdminNotifications(2, 25).get("content"))
                .isEqualTo(java.util.List.of());
        verify(apiClient)
                .get(
                        "list_admin_notifications",
                        "/api/admin/notifications",
                        Map.of("page", 2, "size", 25, "sort", "createdAt,desc"));
        assertThat(
                        meterRegistry
                                .get("kitezh_mcp_tool_calls_total")
                                .tag("tool", "list_admin_notifications")
                                .tag("status", "success")
                                .counter()
                                .count())
                .isEqualTo(1);
    }

    @Test
    void usesDefaultsWhenPaginationIsOmitted() {
        tools.listAdminNotifications(null, null);
        verify(apiClient)
                .get(
                        "list_admin_notifications",
                        "/api/admin/notifications",
                        Map.of("page", 0, "size", 20, "sort", "createdAt,desc"));
    }

    @Test
    void rejectsInvalidPaginationBeforeCallingApi() {
        assertThatIllegalArgumentException().isThrownBy(() -> tools.listAdminNotifications(-1, 20));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.listAdminNotifications(0, 101));
        verifyNoInteractions(apiClient);
    }

    @Test
    void countsFailedCallsAndRethrowsApiFailure() {
        doThrow(new IllegalStateException("API unavailable"))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());

        assertThatIllegalStateException().isThrownBy(() -> tools.listAdminNotifications(0, 20));

        assertThat(
                        meterRegistry
                                .get("kitezh_mcp_tool_calls_total")
                                .tag("tool", "list_admin_notifications")
                                .tag("status", "error")
                                .counter()
                                .count())
                .isEqualTo(1);
    }

    @Test
    void marksUnexpectedInputFailureAsClientError() {
        doThrow(new IllegalArgumentException("invalid API argument"))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());

        assertThatIllegalArgumentException().isThrownBy(() -> tools.listAdminNotifications(0, 20));

        assertThat(
                        meterRegistry
                                .get("kitezh_mcp_tool_calls_total")
                                .tag("tool", "list_admin_notifications")
                                .tag("status", "client_error")
                                .counter()
                                .count())
                .isEqualTo(1);
    }
}
