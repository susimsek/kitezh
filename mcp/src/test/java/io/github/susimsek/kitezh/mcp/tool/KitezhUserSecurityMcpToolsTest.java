package io.github.susimsek.kitezh.mcp.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KitezhUserSecurityMcpToolsTest {

    private KitezhAdminApiClient apiClient;
    private KitezhUserSecurityMcpTools tools;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        doReturn(List.of(Map.of("key", "CONFIGURE_TOTP")))
                .when(apiClient)
                .getList(anyString(), anyString(), anyMap());
        doReturn(Map.of("content", List.of()))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());
        tools = new KitezhUserSecurityMcpTools(apiClient, new SimpleMeterRegistry());
    }

    @Test
    void listsRequiredActionsForValidatedUser() {
        assertThat(tools.listUserRequiredActions(7L))
                .containsExactly(Map.of("key", "CONFIGURE_TOTP"));
        verify(apiClient)
                .getList(
                        "kitezh_list_user_required_actions",
                        "/api/admin/required-actions/users/7",
                        Map.of());
    }

    @Test
    void listsOfflineSessionsWithBoundedPagination() {
        assertThat(tools.listOfflineSessions(2, 25).get("content")).isEqualTo(List.of());
        verify(apiClient)
                .get(
                        "kitezh_list_offline_sessions",
                        "/api/admin/offline-sessions",
                        Map.of("page", 2, "size", 25, "sort", "refreshTokenIssuedAt,desc"));
    }

    @Test
    void rejectsInvalidUserIdOrPaginationBeforeCallingApi() {
        assertThatIllegalArgumentException().isThrownBy(() -> tools.listUserRequiredActions(0L));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.listUserRequiredActions(null));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.listOfflineSessions(-1, 20));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.listOfflineSessions(0, 101));
        verifyNoInteractions(apiClient);
    }
}
