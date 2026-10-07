package io.github.susimsek.kitezh.web.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.account.OrganizationInvitationAcceptanceDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationInvitationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;

@ExtendWith(MockitoExtension.class)
class AccountOrganizationInvitationControllerTest {

    @Mock private AdminOrganizationInvitationService invitationService;

    @Test
    void acceptsInvitationForAuthenticatedUser() {
        AccountOrganizationInvitationController controller =
                new AccountOrganizationInvitationController(invitationService);
        OrganizationInvitationAcceptanceDTO accepted =
                new OrganizationInvitationAcceptanceDTO(8L, "acme", "Acme");
        when(invitationService.accept("token", "alice")).thenReturn(accepted);

        assertThat(controller.accept("token", new TestingAuthenticationToken("alice", "N/A")))
                .isEqualTo(accepted);
    }
}
