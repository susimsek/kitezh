package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminGroupDTO;
import io.github.susimsek.kitezh.dto.admin.AdminGroupPermissionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminGroupPermissionsRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminGroupRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminGroupUserDTO;
import io.github.susimsek.kitezh.dto.admin.AdminGroupUserRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminGroupService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

class AdminGroupControllerTest {

    private final AdminGroupService service = mock(AdminGroupService.class);
    private final AdminGroupController controller = new AdminGroupController(service);
    private final Authentication authentication =
            UsernamePasswordAuthenticationToken.authenticated("admin", null, List.of());

    @Test
    void delegatesGroupAndMembershipOperations() {
        PageRequest pageable = PageRequest.of(0, 20);
        AdminGroupDTO group = mock(AdminGroupDTO.class);
        when(group.id()).thenReturn(7L);
        Page<AdminGroupDTO> groups = Page.empty(pageable);
        Page<AdminGroupUserDTO> users = Page.empty(pageable);
        when(service.findAll("finance", pageable, "admin")).thenReturn(groups);
        when(service.findById(7L, "admin")).thenReturn(group);
        when(service.users(7L, "alice", pageable, "admin")).thenReturn(users);
        when(service.availableUsers(7L, "alice", pageable, "admin")).thenReturn(users);
        when(service.create(org.mockito.ArgumentMatchers.any())).thenReturn(group);
        when(service.update(eq(7L), any(), eq("admin"))).thenReturn(group);
        when(service.updateRoles(eq(7L), any(), eq("admin"))).thenReturn(group);
        when(service.addUser(eq(7L), any(), eq("admin"))).thenReturn(group);
        when(service.removeUser(7L, 8L, "admin")).thenReturn(group);

        assertThat(controller.findAll("finance", pageable, authentication)).isSameAs(groups);
        assertThat(controller.findById(7L, authentication)).isSameAs(group);
        assertThat(controller.create(mock(AdminGroupRequestDTO.class)).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        assertThat(controller.update(7L, null, authentication)).isSameAs(group);
        assertThat(controller.updateRoles(7L, null, authentication)).isSameAs(group);
        assertThat(controller.users(7L, "alice", pageable, authentication)).isSameAs(users);
        assertThat(controller.availableUsers(7L, "alice", pageable, authentication))
                .isSameAs(users);
        assertThat(controller.addUser(7L, mock(AdminGroupUserRequestDTO.class), authentication))
                .isSameAs(group);
        assertThat(controller.removeUser(7L, 8L, authentication)).isSameAs(group);
        assertThat(controller.delete(7L, authentication).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(service).delete(7L, "admin");
    }

    @Test
    void delegatesGroupPermissionOperations() {
        List<AdminGroupPermissionDTO> permissions = List.of(mock(AdminGroupPermissionDTO.class));
        when(service.permissions(7L)).thenReturn(permissions);
        when(service.updatePermissions(eq(7L), any())).thenReturn(permissions);

        assertThat(controller.permissions(7L)).isSameAs(permissions);
        assertThat(controller.updatePermissions(7L, mock(AdminGroupPermissionsRequestDTO.class)))
                .isSameAs(permissions);
        verify(service).permissions(7L);
    }
}
