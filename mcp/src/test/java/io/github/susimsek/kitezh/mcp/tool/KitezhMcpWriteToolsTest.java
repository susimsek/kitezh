package io.github.susimsek.kitezh.mcp.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.github.susimsek.kitezh.mcp.service.McpWritePreviewRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class KitezhMcpWriteToolsTest {

    private KitezhAdminApiClient apiClient;
    private KitezhMcpWriteTools tools;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        tools =
                new KitezhMcpWriteTools(
                        apiClient, new McpWritePreviewRegistry(), new SimpleMeterRegistry());
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken("alice", "n/a", List.of()));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void previewsAndAppliesUserEnabledChange() {
        doReturn(Map.of("enabled", true))
                .when(apiClient)
                .get("preview_set_user_enabled", "/api/admin/users/7", Map.of());
        doReturn(Map.of("enabled", true))
                .when(apiClient)
                .get("apply_set_user_enabled", "/api/admin/users/7", Map.of());

        Map<String, Object> preview = tools.previewSetUserEnabled(7L, false);
        assertThat(preview)
                .containsEntry("status", "preview_ready")
                .containsEntry("requiresUserApproval", true);
        assertThat(tools.applySetUserEnabled((String) preview.get("previewToken")))
                .containsEntry("status", "applied");
        verify(apiClient)
                .put(
                        "apply_set_user_enabled",
                        "/api/admin/users/7/enabled",
                        Map.of("enabled", false));
    }

    @Test
    void rejectsNoopOrMissingUserState() {
        doReturn(Map.of("enabled", true)).when(apiClient).get(anyString(), anyString(), anyMap());
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.previewSetUserEnabled(7L, true));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.previewSetUserEnabled(7L, null));
        doReturn(Map.of()).when(apiClient).get(anyString(), anyString(), anyMap());
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.previewSetUserEnabled(7L, false));
    }

    @Test
    void rejectsStaleUserPreviewBeforeMutation() {
        doReturn(Map.of("enabled", true))
                .when(apiClient)
                .get("preview_set_user_enabled", "/api/admin/users/7", Map.of());
        Map<String, Object> preview = tools.previewSetUserEnabled(7L, false);
        doReturn(Map.of("enabled", false))
                .when(apiClient)
                .get("apply_set_user_enabled", "/api/admin/users/7", Map.of());

        assertThatIllegalStateException()
                .isThrownBy(() -> tools.applySetUserEnabled((String) preview.get("previewToken")));
        verify(apiClient, never()).put(anyString(), anyString(), anyMap());
    }

    @Test
    void previewsAndAppliesGroupMembershipChanges() {
        doReturn(Map.of("id", 4)).when(apiClient).get("get_group", "/api/admin/groups/3", Map.of());
        doReturn(Map.of("id", 7))
                .when(apiClient)
                .get("preview_add_user_to_group", "/api/admin/users/7", Map.of());
        doReturn(Map.of("totalPages", 1, "content", List.of()))
                .when(apiClient)
                .get(
                        "preview_add_user_to_group",
                        "/api/admin/groups/3/users",
                        Map.of("size", 100, "sort", "username,asc"));
        Map<String, Object> add = tools.previewAddUserToGroup(3L, 7L);
        doReturn(Map.of("totalPages", 1, "content", List.of()))
                .when(apiClient)
                .get(
                        "apply_add_user_to_group",
                        "/api/admin/groups/3/users",
                        Map.of("size", 100, "sort", "username,asc"));
        assertThat(tools.applyAddUserToGroup((String) add.get("previewToken")))
                .containsEntry("status", "applied");
        verify(apiClient)
                .post("apply_add_user_to_group", "/api/admin/groups/3/users", Map.of("userId", 7L));

        doReturn(Map.of("totalPages", 1, "content", List.of(Map.of("id", 7))))
                .when(apiClient)
                .get(
                        "preview_remove_user_from_group",
                        "/api/admin/groups/3/users",
                        Map.of("size", 100, "sort", "username,asc"));
        Map<String, Object> remove = tools.previewRemoveUserFromGroup(3L, 7L);
        doReturn(Map.of("totalPages", 1, "content", List.of(Map.of("id", 7))))
                .when(apiClient)
                .get(
                        "apply_remove_user_from_group",
                        "/api/admin/groups/3/users",
                        Map.of("size", 100, "sort", "username,asc"));
        tools.applyRemoveUserFromGroup((String) remove.get("previewToken"));
        verify(apiClient).delete("apply_remove_user_from_group", "/api/admin/groups/3/users/7");
    }

    @Test
    void rejectsInvalidMembershipTransitionsAndOversizedGroups() {
        doReturn(Map.of()).when(apiClient).get(anyString(), anyString(), anyMap());
        assertThatIllegalArgumentException().isThrownBy(() -> tools.previewAddUserToGroup(0L, 7L));
        doReturn(Map.of("totalPages", 101)).when(apiClient).get(anyString(), anyString(), anyMap());
        assertThatIllegalArgumentException().isThrownBy(() -> tools.previewAddUserToGroup(3L, 7L));
        doReturn(Map.of("totalPages", 1, "content", List.of(Map.of("id", 7))))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());
        assertThatIllegalArgumentException().isThrownBy(() -> tools.previewAddUserToGroup(3L, 7L));
        doReturn(Map.of("content", List.of()))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());
        assertThatIllegalArgumentException().isThrownBy(() -> tools.previewAddUserToGroup(3L, 7L));
        doReturn(Map.of("totalPages", 1, "content", List.of()))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.previewRemoveUserFromGroup(3L, 7L));
    }

    @Test
    void findsMembershipOnLaterPage() {
        doReturn(Map.of()).when(apiClient).get("get_group", "/api/admin/groups/3", Map.of());
        doReturn(Map.of())
                .when(apiClient)
                .get("preview_remove_user_from_group", "/api/admin/users/7", Map.of());
        doReturn(Map.of("totalPages", 2, "content", List.of()))
                .when(apiClient)
                .get(
                        "preview_remove_user_from_group",
                        "/api/admin/groups/3/users",
                        Map.of("size", 100, "sort", "username,asc"));
        doReturn(Map.of("totalPages", 2, "content", List.of(Map.of("id", 7))))
                .when(apiClient)
                .get(
                        "preview_remove_user_from_group",
                        "/api/admin/groups/3/users",
                        Map.of("size", 100, "sort", "username,asc", "page", 1));

        assertThat(tools.previewRemoveUserFromGroup(3L, 7L))
                .containsEntry("status", "preview_ready");
    }

    @Test
    void previewsAndAppliesSessionRevocation() {
        doReturn(Map.of("id", "session-1"))
                .when(apiClient)
                .get("preview_revoke_session", "/api/admin/sessions/session-1", Map.of());
        doReturn(Map.of("id", "session-1"))
                .when(apiClient)
                .get("apply_revoke_session", "/api/admin/sessions/session-1", Map.of());
        Map<String, Object> preview = tools.previewRevokeSession("session-1");
        assertThat(tools.applyRevokeSession((String) preview.get("previewToken")))
                .containsEntry("status", "applied");
        verify(apiClient).delete("apply_revoke_session", "/api/admin/sessions/session-1");
    }

    @Test
    void rejectsInvalidSessionAndWrongCallerOrAction() {
        assertThatIllegalArgumentException().isThrownBy(() -> tools.previewRevokeSession("../bad"));
        doReturn(Map.of("enabled", true)).when(apiClient).get(anyString(), anyString(), anyMap());
        Map<String, Object> preview = tools.previewSetUserEnabled(7L, false);
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.applyRevokeSession((String) preview.get("previewToken")));
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken("bob", "n/a", List.of()));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.applySetUserEnabled((String) preview.get("previewToken")));
    }
}
