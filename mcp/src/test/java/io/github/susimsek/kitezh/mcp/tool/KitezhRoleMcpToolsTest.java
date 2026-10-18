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

class KitezhRoleMcpToolsTest {

    private KitezhAdminApiClient apiClient;
    private KitezhRoleMcpTools tools;
    private SimpleMeterRegistry meterRegistry;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        meterRegistry = new SimpleMeterRegistry();
        doReturn(Map.of("result", "ok")).when(apiClient).get(anyString(), anyString(), anyMap());
        doReturn(List.of(Map.of("permission", "MANAGE_MEMBERS")))
                .when(apiClient)
                .getList(anyString(), anyString(), anyMap());
        tools = new KitezhRoleMcpTools(apiClient, meterRegistry);
    }

    @Test
    void searchesRealmRolesWithBoundedPaging() {
        assertThat(tools.searchRoles("USER", null, null)).isEqualTo(Map.of("result", "ok"));
        verify(apiClient)
                .get(
                        "kitezh_search_roles",
                        "/api/admin/roles",
                        Map.of("page", 0, "size", 20, "sort", "name,asc", "q", "USER"));
    }

    @Test
    void getsRealmRoleWithMemberFiltersAndPaging() {
        tools.getRole("ROLE_USER", "alice", true, 1, 25);
        verify(apiClient)
                .get(
                        "kitezh_get_role",
                        "/api/admin/roles/ROLE_USER",
                        Map.of(
                                "page",
                                1,
                                "size",
                                25,
                                "sort",
                                "username,asc",
                                "q",
                                "alice",
                                "enabled",
                                true));
    }

    @Test
    void searchesAndGetsClientRoles() {
        tools.searchClientRoles("billing-api", "invoice", 2, 40);
        verify(apiClient)
                .get(
                        "kitezh_search_client_roles",
                        "/api/admin/clients/billing-api/roles",
                        Map.of("page", 2, "size", 40, "sort", "name,asc", "q", "invoice"));
        tools.getClientRole("billing-api", 7L, "alice", 0, 15);
        verify(apiClient)
                .get(
                        "kitezh_get_client_role",
                        "/api/admin/clients/billing-api/roles/7",
                        Map.of("page", 0, "size", 15, "sort", "username,asc", "q", "alice"));
    }

    @Test
    void listsGroupMembersAndPermissions() {
        tools.listGroupMembers(3L, "alice", 1, 30);
        verify(apiClient)
                .get(
                        "kitezh_list_group_members",
                        "/api/admin/groups/3/users",
                        Map.of("page", 1, "size", 30, "sort", "username,asc", "q", "alice"));
        assertThat(tools.getGroupPermissions(3L))
                .containsExactly(Map.of("permission", "MANAGE_MEMBERS"));
        verify(apiClient)
                .getList(
                        "kitezh_get_group_permissions",
                        "/api/admin/groups/3/permissions",
                        Map.of());
    }

    @Test
    void rejectsInvalidIdentifiersAndPagingBeforeCallingApi() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.getRole("../users", null, null, 0, 20));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.searchClientRoles("billing/api", null, 0, 20));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.getClientRole("billing-api", 0L, null, 0, 20));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.listGroupMembers(0L, null, 0, 20));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.searchRoles(null, 0, 101));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.getGroupPermissions(-1L));
        verifyNoInteractions(apiClient);
    }

    @Test
    void rejectsOversizedOrControlCharacterSearchAndRecordsToolMetrics() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.searchRoles("x".repeat(257), 0, 20));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.searchClientRoles("billing-api", "bad\nquery", 0, 20));
        verifyNoInteractions(apiClient);

        tools.searchRoles("USER", 0, 20);
        assertThat(
                        meterRegistry
                                .get("kitezh_mcp_tool_calls_total")
                                .tag("tool", "kitezh_search_roles")
                                .tag("status", "success")
                                .counter()
                                .count())
                .isEqualTo(1);
    }
}
