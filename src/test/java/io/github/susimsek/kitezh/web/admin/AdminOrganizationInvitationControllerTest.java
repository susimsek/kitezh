package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationInvitationStatus;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationInvitationService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationInvitationControllerTest {

    @Mock private AdminOrganizationInvitationService invitationService;

    @Test
    void delegatesInvitationOperations() {
        AdminOrganizationInvitationController controller =
                new AdminOrganizationInvitationController(invitationService);
        AdminOrganizationInvitationDTO invitation =
                new AdminOrganizationInvitationDTO(
                        12L,
                        "alice@example.com",
                        "Alice",
                        OrganizationInvitationStatus.PENDING,
                        Instant.now().plusSeconds(300),
                        "token");
        AdminOrganizationInvitationRequestDTO request =
                new AdminOrganizationInvitationRequestDTO("alice@example.com", "Alice", 24);
        Pageable pageable = Pageable.ofSize(20);
        when(invitationService.findAll(8L, pageable))
                .thenReturn(new PageImpl<>(List.of(invitation)));
        when(invitationService.create(8L, request)).thenReturn(invitation);
        when(invitationService.resend(8L, 12L, request)).thenReturn(invitation);

        assertThat(controller.findAll(8L, pageable).getContent()).containsExactly(invitation);
        var created = controller.create(8L, request);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getHeaders().getLocation())
                .hasPath("/api/admin/organizations/8/invitations/12");
        assertThat(controller.resend(8L, 12L, request)).isEqualTo(invitation);
        assertThat(controller.cancel(8L, 12L).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }
}
