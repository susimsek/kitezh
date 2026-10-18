package io.github.susimsek.kitezh.mcp.resource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.modelcontextprotocol.spec.McpSchema.CompleteRequest.CompleteArgument;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KitezhMcpResourceCompletionsTest {

    private KitezhAdminApiClient apiClient;
    private KitezhMcpResourceCompletions completions;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        completions = new KitezhMcpResourceCompletions(apiClient);
    }

    @Test
    void completesUserIdsFromCallerAuthorizedPagedSearch() {
        doReturn(Map.of("content", List.of(Map.of("id", 42), Map.of("id", 4), Map.of("id", 77))))
                .when(apiClient)
                .get(
                        "complete_users_resource_ids",
                        "/api/admin/users",
                        Map.of("page", 0, "size", 100, "sort", "username,asc"));

        assertThat(completions.completeUserId(new CompleteArgument("userId", "4")))
                .containsExactly("42", "4");
    }

    @Test
    void completesGroupAndClientRecordIdsFromTypedEndpoints() {
        doReturn(Map.of("content", List.of(Map.of("id", 12))))
                .when(apiClient)
                .get(
                        "complete_groups_resource_ids",
                        "/api/admin/groups",
                        Map.of("page", 0, "size", 100, "sort", "name,asc"));
        doReturn(
                        Map.of(
                                "content",
                                List.of(Map.of("id", "ab12-record"), Map.of("id", "cd34-record"))))
                .when(apiClient)
                .get(
                        "complete_clients_resource_ids",
                        "/api/admin/clients",
                        Map.of("page", 0, "size", 100, "sort", "clientId,asc"));

        assertThat(completions.completeGroupId(new CompleteArgument("groupId", "1")))
                .containsExactly("12");
        assertThat(completions.completeClientRecordId(new CompleteArgument("clientRecordId", "ab")))
                .containsExactly("ab12-record");
    }

    @Test
    void rejectsUnrelatedOrUnsafeArgumentsWithoutCallingApi() {
        assertThat(completions.completeUserId(new CompleteArgument("groupId", "4"))).isEmpty();
        assertThat(completions.completeUserId(new CompleteArgument("userId", "../"))).isEmpty();
        assertThat(completions.completeGroupId(new CompleteArgument("groupId", "-1"))).isEmpty();
        assertThat(
                        completions.completeClientRecordId(
                                new CompleteArgument("clientRecordId", "../users")))
                .isEmpty();
        verifyNoInteractions(apiClient);
    }

    @Test
    void returnsNoSuggestionsForUnexpectedPageShape() {
        doReturn(Map.of("items", List.of(Map.of("id", 42))))
                .when(apiClient)
                .get(
                        "complete_users_resource_ids",
                        "/api/admin/users",
                        Map.of("page", 0, "size", 100, "sort", "username,asc"));

        assertThat(completions.completeUserId(new CompleteArgument("userId", "4"))).isEmpty();
        verify(apiClient)
                .get(
                        "complete_users_resource_ids",
                        "/api/admin/users",
                        Map.of("page", 0, "size", 100, "sort", "username,asc"));
    }
}
