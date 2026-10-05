package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminRequiredActionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminUserRequiredActionDTO;
import io.github.susimsek.kitezh.service.admin.AdminUserService;
import io.github.susimsek.kitezh.service.requiredaction.RequiredActionService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

class AdminRequiredActionControllerTest {

    private final RequiredActionService requiredActionService = mock(RequiredActionService.class);
    private final AdminUserService adminUserService = mock(AdminUserService.class);
    private final AdminRequiredActionController controller =
            new AdminRequiredActionController(requiredActionService, adminUserService);
    private final Authentication authentication =
            UsernamePasswordAuthenticationToken.authenticated("admin", null, List.of());

    @Test
    void delegatesDefinitionsAndUserAssignments() {
        List<AdminRequiredActionDTO> definitions = List.of(mock(AdminRequiredActionDTO.class));
        List<AdminUserRequiredActionDTO> actions = List.of(mock(AdminUserRequiredActionDTO.class));
        AdminRequiredActionDTO updated = mock(AdminRequiredActionDTO.class);
        when(requiredActionService.definitions()).thenReturn(definitions);
        when(requiredActionService.userActions(7L)).thenReturn(actions);
        when(requiredActionService.updateDefinition("VERIFY_EMAIL", null)).thenReturn(updated);

        assertThat(controller.definitions()).isSameAs(definitions);
        assertThat(controller.userActions(7L, authentication)).isSameAs(actions);
        assertThat(controller.update("VERIFY_EMAIL", null)).isSameAs(updated);
        assertThat(controller.assign(7L, "VERIFY_EMAIL", authentication).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.unassign(7L, "VERIFY_EMAIL", authentication).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(adminUserService, times(3)).requireManageableUser(7L, "admin");
        verify(requiredActionService).assign(7L, "VERIFY_EMAIL", "admin");
        verify(requiredActionService).unassign(7L, "VERIFY_EMAIL");
    }
}
