package io.github.susimsek.springauthserversamples.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.dto.admin.AdminCibaPolicyDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminCibaPolicyRequestDTO;
import io.github.susimsek.springauthserversamples.service.admin.CibaPolicyService;
import org.junit.jupiter.api.Test;

class AdminCibaPolicyControllerTest {

    private final CibaPolicyService service = mock(CibaPolicyService.class);
    private final AdminCibaPolicyController controller = new AdminCibaPolicyController(service);
    private final AdminCibaPolicyDTO policy =
            new AdminCibaPolicyDTO(300, 5, "all", "preferred", false, false, null);

    @Test
    void getsAndUpdatesPolicy() {
        when(service.get()).thenReturn(policy);
        assertThat(controller.get()).isEqualTo(policy);

        AdminCibaPolicyRequestDTO request =
                new AdminCibaPolicyRequestDTO(120, 10, "push", "required", true, true, "loa2");
        when(service.update(request)).thenReturn(policy);
        assertThat(controller.update(request)).isEqualTo(policy);
        verify(service).update(request);
    }
}
