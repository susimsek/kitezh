package io.github.susimsek.kitezh.mcp.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KitezhOrganizationMcpToolsTest {

    private KitezhAdminApiClient apiClient;
    private KitezhOrganizationMcpTools tools;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        doReturn(Map.of("result", "ok")).when(apiClient).get(anyString(), anyString(), anyMap());
        tools = new KitezhOrganizationMcpTools(apiClient, new SimpleMeterRegistry());
    }

    @Test
    void searchesOrganizationsWithBoundedDefaults() {
        tools.searchOrganizations("acme", null, null);
        verify(apiClient)
                .get(
                        "kitezh_search_organizations",
                        "/api/admin/organizations",
                        Map.of("page", 0, "size", 20, "sort", "name,asc", "q", "acme"));
    }

    @Test
    void readsOrganizationAndMembers() {
        tools.getOrganization(4L);
        verify(apiClient).get("kitezh_get_organization", "/api/admin/organizations/4", Map.of());

        tools.listOrganizationMembers(4L, "alice", 1, 25);
        verify(apiClient)
                .get(
                        "kitezh_list_organization_members",
                        "/api/admin/organizations/4/members",
                        Map.of("page", 1, "size", 25, "sort", "user.username,asc", "q", "alice"));
    }

    @Test
    void readsOrganizationGroupsAndGroupMembers() {
        tools.listOrganizationGroups(4L, null, 0, 20);
        verify(apiClient)
                .get(
                        "kitezh_list_organization_groups",
                        "/api/admin/organizations/4/groups",
                        Map.of("page", 0, "size", 20, "sort", "name,asc"));

        tools.listOrganizationGroupMembers(4L, 7L, null, null, null);
        verify(apiClient)
                .get(
                        "kitezh_list_organization_group_members",
                        "/api/admin/organizations/4/groups/7/members",
                        Map.of("page", 0, "size", 20, "sort", "user.username,asc"));
    }

    @Test
    void readsOrganizationDomainsWithoutVerificationSecrets() {
        when(apiClient.getList(
                        "kitezh_list_organization_domains",
                        "/api/admin/organizations/4/domains",
                        Map.of()))
                .thenReturn(
                        List.of(
                                Map.of(
                                        "id",
                                        3,
                                        "domain",
                                        "example.com",
                                        "verified",
                                        false,
                                        "verificationToken",
                                        "dns-secret")));

        Map<?, ?> result = tools.listOrganizationDomains(4L);

        assertThat(result.get("domains"))
                .isEqualTo(List.of(Map.of("id", 3, "domain", "example.com", "verified", false)));
        verify(apiClient)
                .getList(
                        "kitezh_list_organization_domains",
                        "/api/admin/organizations/4/domains",
                        Map.of());
    }

    @Test
    void readsOrganizationInvitationMetadata() {
        tools.listOrganizationInvitations(4L, 2, 15);
        verify(apiClient)
                .get(
                        "kitezh_list_organization_invitations",
                        "/api/admin/organizations/4/invitations",
                        Map.of("page", 2, "size", 15, "sort", "createdAt,desc"));
    }

    @Test
    void removesEmailAndTokenFieldsRecursively() {
        Map<?, ?> response =
                Map.of(
                        "content",
                        List.of(
                                Map.of(
                                        "id", 1,
                                        "email", "private@example.com",
                                        "role", "MEMBER",
                                        "token", "secret",
                                        "verificationToken", "dns-secret")));
        doReturn(response)
                .when(apiClient)
                .get(
                        "kitezh_list_organization_invitations",
                        "/api/admin/organizations/4/invitations",
                        Map.of("page", 0, "size", 20, "sort", "createdAt,desc"));

        Map<?, ?> result = tools.listOrganizationInvitations(4L, null, null);

        assertThat(result.get("content")).isEqualTo(List.of(Map.of("id", 1, "role", "MEMBER")));
    }

    @Test
    void rejectsInvalidIdentifiersAndPageArgumentsBeforeCallingApi() {
        assertThatIllegalArgumentException().isThrownBy(() -> tools.getOrganization(0L));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.listOrganizationMembers(1L, null, -1, 20));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.listOrganizationGroups(1L, null, 0, 101));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.listOrganizationGroupMembers(1L, 0L, null, 0, 20));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.searchOrganizations("x".repeat(257), 0, 20));
        verifyNoInteractions(apiClient);
    }
}
