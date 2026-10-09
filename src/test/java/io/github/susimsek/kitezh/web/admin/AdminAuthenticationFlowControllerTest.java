package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingType;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationExecutionRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowBindingRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowCopyRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowNodeMoveRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowRequestDTO;
import io.github.susimsek.kitezh.service.admin.AuthenticationFlowService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

class AdminAuthenticationFlowControllerTest {

    private final AuthenticationFlowService service = mock(AuthenticationFlowService.class);
    private final AdminAuthenticationFlowController controller =
            new AdminAuthenticationFlowController(service);

    @Test
    void delegatesAllFlowOperations() {
        var flowRequest =
                new AdminAuthenticationFlowRequestDTO("flow", "Flow", null, null, null, null);
        var executionRequest =
                new AdminAuthenticationExecutionRequestDTO(
                        "otp-form", "OTP", null, null, null, null);
        var copyRequest = new AdminAuthenticationFlowCopyRequestDTO("copy", "Copy", null);
        var bindingRequest = new AdminAuthenticationFlowBindingRequestDTO(1L);
        var moveRequest = new AdminAuthenticationFlowNodeMoveRequestDTO("UP");

        when(service.topLevelFlows(Pageable.unpaged())).thenReturn(new PageImpl<>(List.of()));
        assertThat(controller.flows(Pageable.unpaged())).isNotNull();
        assertThat(controller.flow(1L)).isNull();
        assertThat(controller.create(flowRequest)).isNull();
        assertThat(controller.createSubFlow(1L, flowRequest)).isNull();
        assertThat(controller.update(1L, flowRequest)).isNull();
        assertThat(controller.duplicate(1L, copyRequest)).isNull();
        assertThat(controller.delete(1L).getStatusCode().value()).isEqualTo(204);
        assertThat(controller.createExecution(1L, executionRequest)).isNull();
        assertThat(controller.updateExecution(1L, 2L, executionRequest)).isNull();
        assertThat(controller.deleteExecution(1L, 2L).getStatusCode().value()).isEqualTo(204);
        assertThat(controller.moveNode(1L, "execution", 2L, moveRequest)).isNull();
        assertThat(controller.bindings()).isEmpty();
        assertThat(controller.bind("browser", bindingRequest)).isNull();
        assertThat(controller.unbind("browser")).isNull();
        assertThat(controller.executionProviders()).isEmpty();

        verify(service).delete(1L);
        verify(service).deleteExecution(1L, 2L);
        verify(service).bind(AuthenticationFlowBindingType.BROWSER, bindingRequest);
    }

    @Test
    void rejectsInvalidPathValues() {
        assertThatThrownBy(
                        () ->
                                controller.moveNode(
                                        1L,
                                        "invalid",
                                        2L,
                                        new AdminAuthenticationFlowNodeMoveRequestDTO("UP")))
                .hasMessageContaining("Node type is invalid");
        assertThatThrownBy(
                        () ->
                                controller.bind(
                                        "unknown",
                                        new AdminAuthenticationFlowBindingRequestDTO(1L)))
                .hasMessageContaining("Binding type is invalid");
        assertThatThrownBy(() -> controller.unbind("unknown"))
                .hasMessageContaining("Binding type is invalid");
    }
}
