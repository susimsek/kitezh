package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminImpersonationDTO;
import io.github.susimsek.kitezh.service.admin.AdminUserService;
import io.github.susimsek.kitezh.service.admin.ImpersonationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

@ExtendWith(MockitoExtension.class)
class AdminImpersonationControllerTest {

    @Mock private AdminUserService adminUserService;
    @Mock private ImpersonationService impersonationService;

    @Test
    void requiresManageableUserAndSetsShortLivedTicketCookie() {
        Authentication authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        "admin", null, java.util.List.of());
        AdminImpersonationDTO result =
                new AdminImpersonationDTO("/impersonation/accept", "alice", "raw-ticket");
        when(impersonationService.issue(7L, authentication)).thenReturn(result);
        MockHttpServletResponse response = new MockHttpServletResponse();

        AdminImpersonationDTO actual =
                new AdminImpersonationController(adminUserService, impersonationService)
                        .impersonate(7L, authentication, response);

        assertThat(actual).isSameAs(result);
        assertThat(response.getHeader("Set-Cookie"))
                .contains("IMPERSONATION_TICKET=raw-ticket")
                .contains("HttpOnly")
                .contains("SameSite=Lax")
                .contains("Path=/impersonation")
                .contains("Max-Age=60");
        verify(adminUserService).requireManageableUser(7L, "admin");
        verify(impersonationService).issue(7L, authentication);
    }
}
