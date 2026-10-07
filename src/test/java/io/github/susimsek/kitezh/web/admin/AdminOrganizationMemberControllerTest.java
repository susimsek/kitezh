package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationMembershipType;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationMemberService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationMemberControllerTest {

    @Mock private AdminOrganizationMemberService memberService;

    @Test
    void delegatesMemberOperations() {
        AdminOrganizationMemberController controller =
                new AdminOrganizationMemberController(memberService);
        AdminOrganizationMemberDTO member =
                new AdminOrganizationMemberDTO(
                        4L,
                        2L,
                        "user",
                        "user@example.com",
                        "User",
                        "Example",
                        OrganizationMembershipType.UNMANAGED);
        AdminOrganizationMemberRequestDTO request =
                new AdminOrganizationMemberRequestDTO(2L, OrganizationMembershipType.UNMANAGED);
        Pageable pageable = Pageable.ofSize(20);
        when(memberService.findAll(8L, "user", pageable))
                .thenReturn(new PageImpl<>(List.of(member)));
        when(memberService.add(8L, request)).thenReturn(member);
        when(memberService.update(8L, 2L, request)).thenReturn(member);

        assertThat(controller.findAll(8L, "user", pageable).getContent()).containsExactly(member);
        var added = controller.add(8L, request);
        assertThat(added.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(added.getHeaders().getLocation())
                .hasPath("/api/admin/organizations/8/members/2");
        assertThat(controller.update(8L, 2L, request)).isEqualTo(member);
        assertThat(controller.remove(8L, 2L).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(memberService).remove(8L, 2L);
    }
}
