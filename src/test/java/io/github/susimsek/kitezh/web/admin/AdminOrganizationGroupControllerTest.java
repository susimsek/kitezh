package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationMembershipType;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupMemberRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationGroupService;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationGroupControllerTest {

    @Mock private AdminOrganizationGroupService groupService;

    @Test
    void delegatesOrganizationGroupOperations() {
        AdminOrganizationGroupController controller =
                new AdminOrganizationGroupController(groupService);
        AdminOrganizationGroupDTO group =
                new AdminOrganizationGroupDTO(
                        4L, 8L, "Finance", "Accounting", true, Set.of("role_finance"));
        AdminOrganizationGroupRequestDTO request =
                new AdminOrganizationGroupRequestDTO(
                        "Finance", "Accounting", true, Set.of("role_finance"));
        AdminOrganizationMemberDTO member =
                new AdminOrganizationMemberDTO(
                        5L,
                        2L,
                        "user",
                        "user@example.com",
                        "User",
                        "Example",
                        OrganizationMembershipType.UNMANAGED);
        Pageable pageable = Pageable.ofSize(20);
        when(groupService.findAll(8L, "fin", pageable)).thenReturn(new PageImpl<>(List.of(group)));
        when(groupService.findById(8L, 4L)).thenReturn(group);
        when(groupService.create(8L, request)).thenReturn(group);
        when(groupService.update(8L, 4L, request)).thenReturn(group);
        when(groupService.findMembers(8L, 4L, "user", pageable))
                .thenReturn(new PageImpl<>(List.of(member)));
        when(groupService.addMember(8L, 4L, 2L)).thenReturn(member);

        assertThat(controller.findAll(8L, "fin", pageable).getContent()).containsExactly(group);
        assertThat(controller.findById(8L, 4L)).isEqualTo(group);
        assertThat(controller.create(8L, request).getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(controller.update(8L, 4L, request)).isEqualTo(group);
        assertThat(controller.findMembers(8L, 4L, "user", pageable).getContent())
                .containsExactly(member);
        assertThat(
                        controller
                                .addMember(8L, 4L, new AdminOrganizationGroupMemberRequestDTO(2L))
                                .getBody())
                .isEqualTo(member);
        assertThat(controller.removeMember(8L, 4L, 2L).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
    }
}
