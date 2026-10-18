package io.github.susimsek.kitezh.mcp.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KitezhOrganizationIdentityMcpToolsTest {

    private KitezhAdminApiClient apiClient;
    private KitezhOrganizationIdentityMcpTools tools;
    private SimpleMeterRegistry meterRegistry;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        meterRegistry = new SimpleMeterRegistry();
        tools = new KitezhOrganizationIdentityMcpTools(apiClient, meterRegistry);
    }

    @Test
    void listsOnlySafeOrganizationIdentityProviderMetadata() {
        doReturn(
                        List.of(
                                Map.of(
                                        "providerAlias",
                                        "google",
                                        "providerType",
                                        "oidc",
                                        "displayName",
                                        "Google",
                                        "enabled",
                                        true,
                                        "clientSecret",
                                        "secret",
                                        "accessToken",
                                        "token")))
                .when(apiClient)
                .getList(
                        "kitezh_list_organization_identity_providers",
                        "/api/admin/organizations/12/identity-providers",
                        Map.of());

        Map<String, Object> result = tools.listOrganizationIdentityProviders(12L);

        assertThat(result.get("identityProviders"))
                .isEqualTo(
                        List.of(
                                Map.of(
                                        "providerAlias",
                                        "google",
                                        "providerType",
                                        "oidc",
                                        "displayName",
                                        "Google",
                                        "enabled",
                                        true)));
    }

    @Test
    void listsClaimConfigurationWithoutClaimValues() {
        doReturn(
                        List.of(
                                Map.of(
                                        "id",
                                        4,
                                        "claimName",
                                        "organization",
                                        "claimValue",
                                        "private-organization-data",
                                        "addToAccessToken",
                                        true,
                                        "addToIdToken",
                                        false,
                                        "addToUserInfo",
                                        true)))
                .when(apiClient)
                .getList(
                        "kitezh_list_organization_claims",
                        "/api/admin/organizations/12/claims",
                        Map.of());

        Map<String, Object> result = tools.listOrganizationClaims(12L);

        assertThat(result.get("claims"))
                .isEqualTo(
                        List.of(
                                Map.of(
                                        "id",
                                        4,
                                        "claimName",
                                        "organization",
                                        "addToAccessToken",
                                        true,
                                        "addToIdToken",
                                        false,
                                        "addToUserInfo",
                                        true)));
        verify(apiClient)
                .getList(
                        "kitezh_list_organization_claims",
                        "/api/admin/organizations/12/claims",
                        Map.of());
    }

    @Test
    void rejectsNonPositiveOrganizationIdsBeforeCallingApi() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.listOrganizationIdentityProviders(0L));
        assertThatIllegalArgumentException().isThrownBy(() -> tools.listOrganizationClaims(null));
        verifyNoInteractions(apiClient);
        assertThat(counter("kitezh_list_organization_identity_providers", "client_error"))
                .isEqualTo(1);
        assertThat(counter("kitezh_list_organization_claims", "client_error")).isEqualTo(1);
    }

    @Test
    void recordsUpstreamAndInternalFailures() {
        doThrow(new KitezhAdminApiClient.KitezhApiException("unavailable"))
                .when(apiClient)
                .getList(anyString(), anyString(), anyMap());

        assertThatThrownBy(() -> tools.listOrganizationClaims(12L))
                .isInstanceOf(KitezhAdminApiClient.KitezhApiException.class);

        doThrow(new IllegalStateException("unexpected"))
                .when(apiClient)
                .getList(anyString(), anyString(), anyMap());

        assertThatThrownBy(() -> tools.listOrganizationIdentityProviders(12L))
                .isInstanceOf(IllegalStateException.class);

        assertThat(counter("kitezh_list_organization_claims", "upstream_error")).isEqualTo(1);
        assertThat(counter("kitezh_list_organization_identity_providers", "internal_error"))
                .isEqualTo(1);
    }

    private double counter(String tool, String status) {
        Counter counter =
                meterRegistry
                        .find("kitezh_mcp_tool_calls_total")
                        .tag("tool", tool)
                        .tag("status", status)
                        .counter();
        return counter == null ? 0 : counter.count();
    }
}
