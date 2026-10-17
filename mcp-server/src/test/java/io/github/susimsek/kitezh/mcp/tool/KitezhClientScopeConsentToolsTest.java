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

class KitezhClientScopeConsentToolsTest {

    private KitezhAdminApiClient apiClient;
    private KitezhClientScopeConsentTools tools;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        doReturn(Map.of("result", "ok")).when(apiClient).get(anyString(), anyString(), anyMap());
        tools = new KitezhClientScopeConsentTools(apiClient, new SimpleMeterRegistry());
    }

    @Test
    void searchesAndReadsClientScopeCatalogue() {
        assertThat(tools.searchClientScopes("account", 1, 30)).isEqualTo(Map.of("result", "ok"));
        verify(apiClient)
                .get(
                        "kitezh_search_client_scopes",
                        "/api/admin/client-scopes",
                        Map.of("page", 1, "size", 30, "sort", "name,asc", "q", "account"));

        tools.searchClientScopes("  ", null, null);
        verify(apiClient)
                .get(
                        "kitezh_search_client_scopes",
                        "/api/admin/client-scopes",
                        Map.of("page", 0, "size", 20, "sort", "name,asc"));

        tools.getClientScope("scope_1");
        verify(apiClient)
                .get("kitezh_get_client_scope", "/api/admin/client-scopes/scope_1", Map.of());
    }

    @Test
    void readsClientScopeAssignmentsAndEvaluation() {
        tools.getClientScopeAssignments("client_1");
        verify(apiClient)
                .get(
                        "kitezh_get_client_scope_assignments",
                        "/api/admin/clients/client_1/scope-assignments",
                        Map.of());

        tools.evaluateClientScopes("client_1", "openid profile", "alice");
        verify(apiClient)
                .get(
                        "kitezh_evaluate_client_scopes",
                        "/api/admin/clients/client_1/scope-evaluation",
                        Map.of("scopes", "openid profile", "subject", "alice"));
    }

    @Test
    void searchesListsAndReadsUserConsents() {
        tools.searchConsents("alice", "account-console", "alice", "account-api", 2, 40);
        verify(apiClient)
                .get(
                        "kitezh_search_consents",
                        "/api/admin/consents",
                        Map.of(
                                "page",
                                2,
                                "size",
                                40,
                                "sort",
                                "id.principalName,asc",
                                "q",
                                "alice",
                                "clientId",
                                "account-console",
                                "username",
                                "alice",
                                "scope",
                                "account-api"));

        tools.listUserConsents(5L, 0, 10);
        verify(apiClient)
                .get(
                        "kitezh_list_user_consents",
                        "/api/admin/users/5/consents",
                        Map.of("page", 0, "size", 10, "sort", "id.registeredClientId,asc"));

        tools.getUserConsent("account-console", "alice");
        verify(apiClient)
                .get(
                        "kitezh_get_user_consent",
                        "/api/admin/consents/account-console/alice",
                        Map.of());
    }

    @Test
    void rejectsInvalidPagesIdsAndOversizedArgumentsBeforeApiCall() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.searchClientScopes(null, -1, 20));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.searchConsents(null, null, null, null, 0, 101));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.getClientScope("../users"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.getClientScopeAssignments("client/1"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.evaluateClientScopes("client?1", null, null));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.evaluateClientScopes("client_1", "x".repeat(4097), null));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.evaluateClientScopes("client_1", null, "x".repeat(129)));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.searchClientScopes("x".repeat(257), 0, 20));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.listUserConsents(0L, 0, 20));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.listUserConsents(null, 0, 20));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.getUserConsent("client_1", "alice/bob"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.getUserConsent("../client", "alice"));
        verifyNoInteractions(apiClient);
    }

    @Test
    void propagatesAdminApiFailures() {
        doThrow(new KitezhAdminApiClient.KitezhApiException("upstream failure"))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());

        assertThatRuntimeException()
                .isThrownBy(() -> tools.searchClientScopes(null, 0, 20))
                .isInstanceOf(KitezhAdminApiClient.KitezhApiException.class);
    }
}
