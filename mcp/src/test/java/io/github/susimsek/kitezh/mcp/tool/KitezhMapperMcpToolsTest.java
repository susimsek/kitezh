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
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KitezhMapperMcpToolsTest {

    private KitezhAdminApiClient apiClient;
    private SimpleMeterRegistry meterRegistry;
    private KitezhMapperMcpTools tools;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        meterRegistry = new SimpleMeterRegistry();
        tools = new KitezhMapperMcpTools(apiClient, meterRegistry);
    }

    @Test
    void listsClientMappersWithPaginationAndRedactsUnapprovedFields() {
        Map<String, Object> mapper =
                Map.of(
                        "id", 10,
                        "name", "Email claim",
                        "mapperType", "user-property",
                        "source", "email",
                        "claimName", "email",
                        "addToIdToken", true,
                        "addToAccessToken", true,
                        "priority", 100,
                        "value", "must-not-leak",
                        "clientSecret", "must-not-leak-either");
        doReturn(Map.of("content", List.of(mapper), "totalElements", 1))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());

        Map<String, Object> result = tools.listClientMappers("client-1", "Email", 2, 5);

        assertThat(result)
                .containsEntry("totalElements", 1)
                .containsEntry(
                        "content",
                        List.of(
                                Map.of(
                                        "id",
                                        10,
                                        "name",
                                        "Email claim",
                                        "mapperType",
                                        "user-property",
                                        "source",
                                        "email",
                                        "claimName",
                                        "email",
                                        "addToIdToken",
                                        true,
                                        "addToAccessToken",
                                        true,
                                        "priority",
                                        100)));
        verify(apiClient)
                .get(
                        "list_client_mappers",
                        "/api/admin/clients/client-1/mappers",
                        Map.of("page", 2, "size", 5, "sort", "name,asc", "q", "Email"));
        assertThat(counter("list_client_mappers", "success")).isEqualTo(1);
    }

    @Test
    void listsScopeMappersAndDropsMalformedRows() {
        doReturn(Map.of("content", List.of("unexpected"), "number", 0))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());

        Map<String, Object> result = tools.listClientScopeMappers("scope_1", null, null, null);

        assertThat(result).containsEntry("content", List.of()).containsEntry("number", 0);
        verify(apiClient)
                .get(
                        "list_client_scope_mappers",
                        "/api/admin/client-scopes/scope_1/mappers",
                        Map.of("page", 0, "size", 20, "sort", "name,asc"));
        assertThat(counter("list_client_scope_mappers", "success")).isEqualTo(1);
    }

    @Test
    void usesEmptyContentWhenResponseContentIsNotAList() {
        doReturn(Map.of("content", "invalid"))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());

        assertThat(tools.listClientMappers("client", null, 0, 1))
                .containsEntry("content", List.of());
    }

    @Test
    void rejectsInvalidIdsBeforeCallingApi() {
        assertThatThrownBy(() -> tools.listClientMappers("../secrets", null, 0, 20))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("clientId has an invalid format");
        assertThatThrownBy(() -> tools.listClientScopeMappers("", null, 0, 20))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("scopeId has an invalid format");
    }

    @Test
    void rejectsInvalidSearchAndPagination() {
        assertThatThrownBy(() -> tools.listClientMappers("client", "x".repeat(257), 0, 20))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("q must not exceed 256 characters");
        assertThatThrownBy(() -> tools.listClientScopeMappers("scope", null, -1, 20))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("page must be zero or greater");
        assertThatThrownBy(() -> tools.listClientScopeMappers("scope", null, 0, 101))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("size must be between 1 and 100");
    }

    @Test
    void recordsApiFailureAndPropagatesIt() {
        IllegalStateException error = new IllegalStateException("API unavailable");
        doThrow(error).when(apiClient).get(anyString(), anyString(), anyMap());

        assertThatThrownBy(() -> tools.listClientMappers("client", null, 0, 20)).isSameAs(error);
        assertThat(counter("list_client_mappers", "error")).isEqualTo(1);
    }

    private double counter(String tool, String status) {
        return meterRegistry
                .counter("kitezh_mcp_tool_calls_total", "tool", tool, "status", status)
                .count();
    }
}
