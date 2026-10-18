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
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KitezhMcpToolsTest {

    private KitezhAdminApiClient apiClient;
    private KitezhMcpTools tools;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        doReturn(Map.of("result", "ok")).when(apiClient).get(anyString(), anyString(), anyMap());
        tools = new KitezhMcpTools(apiClient, new SimpleMeterRegistry());
    }

    @Test
    void callsContextEndpoint() {
        assertThat(tools.getContext()).isNotNull();
        verify(apiClient).get("get_context", "/api/admin/whoami", Map.of());
    }

    @Test
    void searchesUsersWithDefaultsAndOptionalFilter() {
        tools.searchUsers("alice", true, null, null);
        verify(apiClient)
                .get(
                        "search_users",
                        "/api/admin/users",
                        Map.of(
                                "page",
                                0,
                                "size",
                                20,
                                "sort",
                                "username,asc",
                                "q",
                                "alice",
                                "enabled",
                                true));
    }

    @Test
    void readsUserAndGroupsWithValidatedId() {
        tools.getUser(9L);
        verify(apiClient).get("get_user", "/api/admin/users/9", Map.of());
        tools.listUserGroups(9L, "ops", 1, 50);
        verify(apiClient)
                .get(
                        "list_user_groups",
                        "/api/admin/users/9/groups",
                        Map.of("page", 1, "size", 50, "sort", "name,asc", "q", "ops"));
    }

    @Test
    void searchesAndReadsGroups() {
        tools.searchGroups("ops", 0, 10);
        verify(apiClient)
                .get(
                        "search_groups",
                        "/api/admin/groups",
                        Map.of("page", 0, "size", 10, "sort", "name,asc", "q", "ops"));
        tools.getGroup(3L);
        verify(apiClient).get("get_group", "/api/admin/groups/3", Map.of());
    }

    @Test
    void searchesAndReadsClients() {
        tools.searchClients("account", 2, 40);
        verify(apiClient)
                .get(
                        "search_clients",
                        "/api/admin/clients",
                        Map.of("page", 2, "size", 40, "sort", "clientId,asc", "q", "account"));
        tools.getClient("record_1");
        verify(apiClient).get("get_client", "/api/admin/clients/record_1", Map.of());
    }

    @Test
    void listsSessionsAndDefaultsToActive() {
        tools.listSessions("alice", "account-console", null, 0, 20);
        verify(apiClient)
                .get(
                        "list_sessions",
                        "/api/admin/sessions",
                        Map.of(
                                "page", 0,
                                "size", 20,
                                "sort", "lastAccessTime,desc",
                                "q", "alice",
                                "clientId", "account-console",
                                "status", "active"));
    }

    @Test
    void searchesEventsWithValidatedTimeRange() {
        tools.searchEvents(
                "alice", "user.updated", "user", "9", "2026-01-01T00:00:00Z", null, 0, 20);
        verify(apiClient)
                .get(
                        "search_events",
                        "/api/admin/events",
                        Map.of(
                                "page", 0,
                                "size", 20,
                                "sort", "occurredAt,desc",
                                "q", "alice",
                                "action", "user.updated",
                                "targetType", "user",
                                "targetId", "9",
                                "from", "2026-01-01T00:00:00Z"));
    }

    @Test
    void rejectsUnsafeArgumentsBeforeCallingApi() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.searchUsers(null, null, -1, 20));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.searchGroups(null, 0, 101));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.getUser(0L));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.getClient("../users"));
        assertThatIllegalArgumentException()
                .isThrownBy(
                        () ->
                                tools.searchEvents(
                                        null,
                                        null,
                                        null,
                                        null,
                                        "2026-02-01T00:00:00Z",
                                        "2026-01-01T00:00:00Z",
                                        0,
                                        20));
        assertThatIllegalArgumentException()
                .isThrownBy(
                        () ->
                                tools.searchEvents(
                                        null, null, null, null, "not-a-date", null, 0, 20));
        verifyNoInteractions(apiClient);
    }
}
