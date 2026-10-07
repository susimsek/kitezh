package io.github.susimsek.kitezh.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthenticationExecutionEntity;
import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingEntity;
import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingType;
import io.github.susimsek.kitezh.domain.AuthenticationFlowEntity;
import io.github.susimsek.kitezh.domain.AuthenticationFlowRequirement;
import io.github.susimsek.kitezh.repository.AuthenticationExecutionRepository;
import io.github.susimsek.kitezh.repository.AuthenticationFlowBindingRepository;
import io.github.susimsek.kitezh.repository.AuthenticationFlowRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AuthenticationFlowRuntimeServiceTest {

    private final AuthenticationFlowBindingRepository bindingRepository =
            mock(AuthenticationFlowBindingRepository.class);
    private final AuthenticationFlowRepository flowRepository =
            mock(AuthenticationFlowRepository.class);
    private final AuthenticationExecutionRepository executionRepository =
            mock(AuthenticationExecutionRepository.class);
    private final AuthenticationFlowRuntimeService service =
            new AuthenticationFlowRuntimeService(
                    bindingRepository, flowRepository, executionRepository);

    @Test
    void resolvesNestedEnabledExecution() {
        AuthenticationFlowEntity root = flow(1L);
        AuthenticationFlowEntity child = flow(2L);
        child.setParentFlow(root);

        AuthenticationFlowBindingEntity binding = new AuthenticationFlowBindingEntity();
        binding.setFlow(root);
        when(bindingRepository.findById(AuthenticationFlowBindingType.BROWSER))
                .thenReturn(Optional.of(binding));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(1L)).thenReturn(List.of());
        AuthenticationExecutionEntity execution = execution("otp-form", false);
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(2L))
                .thenReturn(List.of(execution));
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(1L))
                .thenReturn(List.of(child));
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(2L)).thenReturn(List.of());

        assertThat(
                        service.containsEnabledExecution(
                                AuthenticationFlowBindingType.BROWSER, "OTP-FORM"))
                .isTrue();
    }

    @Test
    void disabledExecutionDoesNotActivateRuntimeProvider() {
        AuthenticationFlowEntity root = flow(1L);
        AuthenticationExecutionEntity execution = execution("otp-form", true);
        AuthenticationFlowBindingEntity binding = new AuthenticationFlowBindingEntity();
        binding.setFlow(root);
        when(bindingRepository.findById(AuthenticationFlowBindingType.BROWSER))
                .thenReturn(Optional.of(binding));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(1L))
                .thenReturn(List.of(execution));
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(1L)).thenReturn(List.of());

        assertThat(
                        service.containsEnabledExecution(
                                AuthenticationFlowBindingType.BROWSER, "otp-form"))
                .isFalse();
    }

    @Test
    void missingBindingPreservesExistingBehavior() {
        when(bindingRepository.findById(AuthenticationFlowBindingType.BROWSER))
                .thenReturn(Optional.empty());

        assertThat(
                        service.containsEnabledExecution(
                                AuthenticationFlowBindingType.BROWSER, "otp-form"))
                .isTrue();
    }

    private static AuthenticationFlowEntity flow(Long id) {
        AuthenticationFlowEntity flow = new AuthenticationFlowEntity();
        flow.setId(id);
        return flow;
    }

    private static AuthenticationExecutionEntity execution(String providerId, boolean disabled) {
        AuthenticationExecutionEntity execution = new AuthenticationExecutionEntity();
        execution.setProviderId(providerId);
        execution.setRequirement(
                disabled
                        ? AuthenticationFlowRequirement.DISABLED
                        : AuthenticationFlowRequirement.REQUIRED);
        return execution;
    }
}
