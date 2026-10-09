package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthenticationExecutionEntity;
import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingEntity;
import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingType;
import io.github.susimsek.kitezh.domain.AuthenticationFlowEntity;
import io.github.susimsek.kitezh.domain.AuthenticationFlowRequirement;
import io.github.susimsek.kitezh.domain.AuthenticationFlowType;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationExecutionRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowBindingRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowCopyRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowNodeMoveRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowRequestDTO;
import io.github.susimsek.kitezh.mapper.AuthenticationFlowMapper;
import io.github.susimsek.kitezh.repository.AuthenticationExecutionRepository;
import io.github.susimsek.kitezh.repository.AuthenticationFlowBindingRepository;
import io.github.susimsek.kitezh.repository.AuthenticationFlowRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.stubbing.Answer;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

class AuthenticationFlowServiceTest {

    private final AuthenticationFlowRepository flowRepository =
            mock(AuthenticationFlowRepository.class);
    private final AuthenticationExecutionRepository executionRepository =
            mock(AuthenticationExecutionRepository.class);
    private final AuthenticationFlowBindingRepository bindingRepository =
            mock(AuthenticationFlowBindingRepository.class);
    private final AuthenticationFlowMapper mapper = mock(AuthenticationFlowMapper.class);
    private final AdminAuditEventService audit = mock(AdminAuditEventService.class);
    private final AuthenticationFlowService service =
            new AuthenticationFlowService(
                    flowRepository, executionRepository, bindingRepository, mapper, audit);

    @BeforeEach
    void setUp() {
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(any()))
                .thenReturn(List.of());
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(any()))
                .thenReturn(List.of());
        when(flowRepository.save(any())).thenAnswer(assignFlowId());
        when(executionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createsReadsUpdatesAndDeletesMutableFlows() {
        AuthenticationFlowEntity parent = flow(1L, "parent", false);
        when(flowRepository.findById(1L)).thenReturn(Optional.of(parent));
        when(flowRepository.existsByAlias(any())).thenReturn(false);

        var created = service.create(flowRequest("custom", "Custom", null, null));
        assertThat(created).isNull();

        var child =
                service.createSubFlow(
                        1L,
                        flowRequest("child", "Child", AuthenticationFlowRequirement.REQUIRED, 20));
        assertThat(child).isNull();

        AuthenticationFlowEntity mutable = flow(2L, "mutable", false);
        when(flowRepository.findById(2L)).thenReturn(Optional.of(mutable));
        service.update(2L, flowRequest("mutable", "Updated", null, 5));
        service.delete(2L);
        verify(flowRepository).delete(mutable);
    }

    @Test
    void readsFlowDetailsAndTopLevelPage() {
        AuthenticationFlowEntity root = flow(1L, "root", false);
        AuthenticationFlowEntity child = flow(2L, "child", false);
        child.setParentFlow(root);
        child.setRequirement(AuthenticationFlowRequirement.ALTERNATIVE);
        child.setPriority(20);
        AuthenticationExecutionEntity execution =
                execution(10L, root, "otp-form", AuthenticationFlowRequirement.REQUIRED, 10);
        when(flowRepository.findById(1L)).thenReturn(Optional.of(root));
        when(flowRepository.findByParentFlowIsNull(any()))
                .thenReturn(new PageImpl<>(List.of(root)));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(1L))
                .thenReturn(List.of(execution));
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(1L))
                .thenReturn(List.of(child));
        when(mapper.toFlowDTO(any())).thenReturn(null);
        when(mapper.toExecutionDTO(any())).thenReturn(null);

        assertThat(service.flow(1L).nodes()).hasSize(2);
        assertThat(service.topLevelFlows(Pageable.unpaged())).isNotNull();
    }

    @Test
    void managesExecutionsAndReordersMixedNodes() {
        AuthenticationFlowEntity flow = flow(1L, "flow", false);
        when(flowRepository.findById(1L)).thenReturn(Optional.of(flow));
        when(executionRepository.findByIdAndFlowId(10L, 1L))
                .thenReturn(
                        Optional.of(
                                execution(
                                        10L,
                                        flow,
                                        "otp-form",
                                        AuthenticationFlowRequirement.REQUIRED,
                                        10)));
        when(mapper.toExecutionDTO(any())).thenReturn(null);

        service.createExecution(1L, executionRequest("OTP", "otp-form", "{}", 10));
        service.updateExecution(1L, 10L, executionRequest("OTP updated", "otp-form", null, 20));
        service.deleteExecution(1L, 10L);
        assertThat(flowRepository.findById(1L)).isPresent();
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(1L))
                .thenReturn(
                        List.of(
                                execution(
                                        10L,
                                        flow,
                                        "otp-form",
                                        AuthenticationFlowRequirement.REQUIRED,
                                        10)));
        service.moveNode(
                1L, "EXECUTION", 10L, new AdminAuthenticationFlowNodeMoveRequestDTO("DOWN"));
    }

    @Test
    void duplicatesBindsAndUnbindsFlows() {
        AuthenticationFlowEntity source = flow(1L, "source", false);
        when(flowRepository.findById(1L)).thenReturn(Optional.of(source));
        when(flowRepository.existsByAlias(any())).thenReturn(false);
        when(mapper.toFlowDTO(any())).thenReturn(null);
        service.duplicate(
                1L, new AdminAuthenticationFlowCopyRequestDTO("copy", "Copy", " description "));

        AuthenticationFlowBindingEntity binding = new AuthenticationFlowBindingEntity();
        binding.setBindingType(AuthenticationFlowBindingType.BROWSER);
        binding.setFlow(source);
        when(bindingRepository.findById(AuthenticationFlowBindingType.BROWSER))
                .thenReturn(Optional.of(binding));
        when(flowRepository.findById(1L)).thenReturn(Optional.of(source));
        assertThat(
                        service.bind(
                                AuthenticationFlowBindingType.BROWSER,
                                new AdminAuthenticationFlowBindingRequestDTO(1L)))
                .isNotNull();
        assertThat(service.unbind(AuthenticationFlowBindingType.BROWSER)).isNotNull();
        assertThat(service.bindings()).hasSize(AuthenticationFlowBindingType.values().length);
        assertThat(service.executionProviders()).contains("otp-form");
    }

    @Test
    void rejectsInvalidGraphAndProtectedOperations() {
        AuthenticationFlowEntity builtIn = flow(1L, "browser", true);
        when(flowRepository.findById(1L)).thenReturn(Optional.of(builtIn));
        assertThatThrownBy(() -> service.delete(1L)).hasMessageContaining("Built-in");
        assertThatThrownBy(
                        () ->
                                service.create(
                                        flowRequest(
                                                "top",
                                                "Top",
                                                AuthenticationFlowRequirement.REQUIRED,
                                                null)))
                .hasMessageContaining("Top-level");
        AuthenticationFlowEntity mutable = flow(2L, "mutable", false);
        when(flowRepository.findById(2L)).thenReturn(Optional.of(mutable));
        assertThatThrownBy(
                        () ->
                                service.createExecution(
                                        2L, executionRequest("Bad", "unsupported", null, 0)))
                .hasMessageContaining("not supported");
        assertThatThrownBy(
                        () ->
                                service.createExecution(
                                        2L, executionRequest("Bad", "otp-form", "[]", 0)))
                .hasMessageContaining("JSON object");
        assertThatThrownBy(
                        () ->
                                service.createExecution(
                                        2L,
                                        new AdminAuthenticationExecutionRequestDTO(
                                                "otp-form",
                                                "Conditional",
                                                AuthenticationFlowRequirement.CONDITIONAL,
                                                null,
                                                null,
                                                0)))
                .hasMessageContaining("Conditional");
        assertThatThrownBy(
                        () ->
                                service.moveNode(
                                        2L,
                                        "EXECUTION",
                                        1L,
                                        new AdminAuthenticationFlowNodeMoveRequestDTO("sideways")))
                .hasMessageContaining("UP or DOWN");
    }

    @Test
    void rejectsDeletionWhenFlowHasChildrenExecutionsOrBinding() {
        AuthenticationFlowEntity flow = flow(1L, "custom", false);
        when(flowRepository.findById(1L)).thenReturn(Optional.of(flow));
        when(flowRepository.existsByParentFlowId(1L)).thenReturn(true);
        assertThatThrownBy(() -> service.delete(1L)).hasMessageContaining("sub-flows");
        when(flowRepository.existsByParentFlowId(1L)).thenReturn(false);
        when(executionRepository.existsByFlowId(1L)).thenReturn(true);
        assertThatThrownBy(() -> service.delete(1L)).hasMessageContaining("executions");
        when(executionRepository.existsByFlowId(1L)).thenReturn(false);
        when(bindingRepository.existsByFlowId(1L)).thenReturn(true);
        assertThatThrownBy(() -> service.delete(1L)).hasMessageContaining("Unbind");
    }

    @Test
    void coversSubFlowExecutionAndBuiltInValidationRules() {
        AuthenticationFlowEntity top = flow(1L, "top", false);
        when(flowRepository.findById(1L)).thenReturn(Optional.of(top));
        assertThatThrownBy(() -> service.createSubFlow(1L, flowRequest("child", "Child", null, 0)))
                .hasMessageContaining("requirement");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        1L,
                                        flowRequest(
                                                "top",
                                                "Top",
                                                AuthenticationFlowRequirement.REQUIRED,
                                                0)))
                .hasMessageContaining("Top-level");

        AuthenticationFlowEntity child = flow(2L, "child", false);
        child.setParentFlow(top);
        when(flowRepository.findById(2L)).thenReturn(Optional.of(child));
        assertThatThrownBy(() -> service.update(2L, flowRequest("child", "Child", null, 0)))
                .hasMessageContaining("requirement");

        AuthenticationFlowEntity builtIn = flow(3L, "built-in", true);
        when(flowRepository.findById(3L)).thenReturn(Optional.of(builtIn));
        assertThatThrownBy(() -> service.update(3L, flowRequest("changed", "Changed", null, 0)))
                .hasMessageContaining("metadata");

        assertThatThrownBy(() -> service.update(3L, flowRequest("built-in", "built-in", null, 10)))
                .hasMessageContaining("metadata");

        AuthenticationFlowEntity builtInSubFlow = flow(4L, "built-in-sub-flow", true);
        builtInSubFlow.setParentFlow(builtIn);
        builtInSubFlow.setRequirement(AuthenticationFlowRequirement.ALTERNATIVE);
        builtInSubFlow.setPriority(10);
        when(flowRepository.findById(4L)).thenReturn(Optional.of(builtInSubFlow));
        assertThatThrownBy(
                        () ->
                                service.update(
                                        4L,
                                        flowRequest(
                                                "built-in-sub-flow",
                                                "built-in-sub-flow",
                                                AuthenticationFlowRequirement.REQUIRED,
                                                20)))
                .hasMessageContaining("metadata");

        when(flowRepository.findById(1L)).thenReturn(Optional.of(top));
        service.createExecution(1L, executionRequest("OTP", "otp-form", null, 0));
        service.createExecution(
                1L, executionRequest("OTP default priority", "otp-form", null, null));
        assertThatThrownBy(
                        () ->
                                service.createExecution(
                                        1L, executionRequest("Negative", "otp-form", null, -1)))
                .hasMessageContaining("negative");
    }

    @Test
    void coversAdditionalFlowValidationBranches() {
        when(flowRepository.existsByAlias("duplicate")).thenReturn(true);
        assertThatThrownBy(() -> service.create(flowRequest("duplicate", "Duplicate", null, null)))
                .hasMessageContaining("already registered");

        AuthenticationFlowEntity builtIn = flow(10L, "built-in", true);
        when(flowRepository.findById(10L)).thenReturn(Optional.of(builtIn));
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(10L))
                .thenReturn(List.of());
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(10L)).thenReturn(List.of());
        when(mapper.toFlowDTO(any())).thenReturn(null);
        service.update(10L, flowRequest("built-in", "built-in", null, null));

        AuthenticationFlowEntity flow = flow(20L, "flow", false);
        AuthenticationExecutionEntity execution =
                execution(30L, flow, "otp-form", AuthenticationFlowRequirement.REQUIRED, 5);
        when(flowRepository.findById(20L)).thenReturn(Optional.of(flow));
        when(executionRepository.findByIdAndFlowId(30L, 20L)).thenReturn(Optional.of(execution));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(20L))
                .thenReturn(List.of(execution));
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(20L))
                .thenReturn(List.of());
        when(mapper.toExecutionDTO(any())).thenReturn(null);
        service.updateExecution(20L, 30L, executionRequest("OTP", "otp-form", null, null));

        AuthenticationFlowEntity missingExecutionFlow = flow(40L, "missing", false);
        when(flowRepository.findById(40L)).thenReturn(Optional.of(missingExecutionFlow));
        when(executionRepository.findByIdAndFlowId(99L, 40L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.deleteExecution(40L, 99L))
                .hasMessageContaining("not found");

        AuthenticationFlowEntity missingSubFlow = flow(50L, "parent", false);
        when(flowRepository.findById(50L)).thenReturn(Optional.of(missingSubFlow));
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(50L))
                .thenReturn(List.of());
        assertThatThrownBy(
                        () ->
                                service.moveNode(
                                        50L,
                                        "SUB_FLOW",
                                        99L,
                                        new AdminAuthenticationFlowNodeMoveRequestDTO("UP")))
                .hasMessageContaining("not found");

        assertThatThrownBy(
                        () ->
                                service.createExecution(
                                        50L, executionRequest("Invalid", "otp-form", "invalid", 0)))
                .hasMessageContaining("valid JSON");
    }

    @Test
    void validatesBuiltInExecutionsAndGraphRequirements() {
        AuthenticationFlowEntity builtIn = flow(1L, "browser", true);
        AuthenticationExecutionEntity existing =
                execution(10L, builtIn, "otp-form", AuthenticationFlowRequirement.REQUIRED, 10);
        when(flowRepository.findById(1L)).thenReturn(Optional.of(builtIn));
        when(executionRepository.findByIdAndFlowId(10L, 1L)).thenReturn(Optional.of(existing));
        assertThatThrownBy(
                        () ->
                                service.updateExecution(
                                        1L, 10L, executionRequest("Changed", "otp-form", null, 10)))
                .hasMessageContaining("cannot be changed");
        when(executionRepository.findByIdAndFlowId(11L, 1L)).thenReturn(Optional.empty());
        assertThatThrownBy(
                        () ->
                                service.updateExecution(
                                        1L, 11L, executionRequest("OTP", "otp-form", null, 10)))
                .hasMessageContaining("not found");

        AuthenticationFlowEntity mixed = flow(20L, "mixed", false);
        AuthenticationFlowEntity alternative = flow(21L, "alternative", false);
        alternative.setParentFlow(mixed);
        alternative.setRequirement(AuthenticationFlowRequirement.ALTERNATIVE);
        when(flowRepository.findById(20L)).thenReturn(Optional.of(mixed));
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(20L))
                .thenReturn(List.of(alternative));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(20L))
                .thenReturn(
                        List.of(
                                execution(
                                        22L,
                                        mixed,
                                        "otp-form",
                                        AuthenticationFlowRequirement.REQUIRED,
                                        10)));
        assertThatThrownBy(
                        () ->
                                service.createExecution(
                                        20L, executionRequest("OTP", "otp-form", null, 20)))
                .hasMessageContaining("mix");

        AuthenticationFlowEntity conditional = flow(30L, "conditional", false);
        conditional.setRequirement(AuthenticationFlowRequirement.CONDITIONAL);
        when(flowRepository.findById(30L)).thenReturn(Optional.of(conditional));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(30L))
                .thenReturn(
                        List.of(
                                execution(
                                        31L,
                                        conditional,
                                        "otp-form",
                                        AuthenticationFlowRequirement.REQUIRED,
                                        10)));
        assertThatThrownBy(
                        () ->
                                service.createExecution(
                                        30L, executionRequest("OTP", "otp-form", null, 10)))
                .hasMessageContaining("condition");

        AuthenticationFlowEntity childBinding = flow(50L, "child-binding", false);
        childBinding.setParentFlow(mixed);
        when(flowRepository.findById(50L)).thenReturn(Optional.of(childBinding));
        assertThatThrownBy(
                        () ->
                                service.bind(
                                        AuthenticationFlowBindingType.BROWSER,
                                        new AdminAuthenticationFlowBindingRequestDTO(50L)))
                .hasMessageContaining("top-level");
    }

    @Test
    void reordersSubFlowsCopiesChildrenAndHandlesUnboundEntries() {
        AuthenticationFlowEntity root = flow(1L, "root", false);
        AuthenticationFlowEntity child = flow(2L, "child", false);
        child.setParentFlow(root);
        child.setRequirement(AuthenticationFlowRequirement.ALTERNATIVE);
        child.setPriority(20);
        AuthenticationExecutionEntity execution =
                execution(10L, root, "otp-form", AuthenticationFlowRequirement.REQUIRED, 10);
        when(flowRepository.findById(1L)).thenReturn(Optional.of(root));
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(1L))
                .thenReturn(List.of(child));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(1L))
                .thenReturn(List.of(execution));
        service.moveNode(1L, "SUB_FLOW", 2L, new AdminAuthenticationFlowNodeMoveRequestDTO("UP"));
        verify(flowRepository).save(child);
        verify(executionRepository).save(execution);

        AuthenticationFlowEntity source = flow(40L, "source", false);
        AuthenticationFlowEntity sourceChild = flow(41L, "nested", false);
        sourceChild.setParentFlow(source);
        sourceChild.setRequirement(AuthenticationFlowRequirement.REQUIRED);
        AuthenticationExecutionEntity sourceExecution =
                execution(42L, source, "otp-form", AuthenticationFlowRequirement.REQUIRED, 5);
        when(flowRepository.findById(40L)).thenReturn(Optional.of(source));
        when(flowRepository.existsByAlias(any())).thenReturn(false, true, false);
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(40L))
                .thenReturn(List.of(sourceChild));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(40L))
                .thenReturn(List.of(sourceExecution));
        service.duplicate(40L, new AdminAuthenticationFlowCopyRequestDTO("copy", "Copy", null));

        when(flowRepository.findById(1L)).thenReturn(Optional.of(root));
        when(executionRepository.findByIdAndFlowId(99L, 1L)).thenReturn(Optional.empty());
        assertThatThrownBy(
                        () ->
                                service.moveNode(
                                        1L,
                                        "EXECUTION",
                                        99L,
                                        new AdminAuthenticationFlowNodeMoveRequestDTO("DOWN")))
                .hasMessageContaining("not found");
    }

    @Test
    void coversRemainingExecutionAndGraphBranches() {
        AuthenticationFlowEntity builtIn = flow(60L, "built-in", true);
        AuthenticationExecutionEntity unchanged =
                execution(61L, builtIn, "otp-form", AuthenticationFlowRequirement.REQUIRED, 10);
        when(flowRepository.findById(60L)).thenReturn(Optional.of(builtIn));
        when(executionRepository.findByIdAndFlowId(61L, 60L)).thenReturn(Optional.of(unchanged));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(60L))
                .thenReturn(List.of(unchanged));
        when(mapper.toExecutionDTO(any())).thenReturn(null);
        service.updateExecution(60L, 61L, executionRequest("otp-form", "otp-form", null, null));

        AuthenticationFlowEntity mutable = flow(62L, "mutable", false);
        when(flowRepository.findById(62L)).thenReturn(Optional.of(mutable));
        assertThatThrownBy(
                        () ->
                                service.createExecution(
                                        62L,
                                        new AdminAuthenticationExecutionRequestDTO(
                                                null,
                                                "Missing provider",
                                                AuthenticationFlowRequirement.REQUIRED,
                                                null,
                                                null,
                                                0)))
                .hasMessageContaining("not supported");

        AuthenticationFlowEntity protectedFlow = flow(63L, "protected", true);
        when(flowRepository.findById(63L)).thenReturn(Optional.of(protectedFlow));
        assertThatThrownBy(
                        () ->
                                service.createExecution(
                                        63L, executionRequest("OTP", "otp-form", null, 0)))
                .hasMessageContaining("structure cannot be changed");

        AuthenticationFlowEntity reordered = flow(64L, "reordered", false);
        AuthenticationExecutionEntity first =
                execution(641L, reordered, "otp-form", AuthenticationFlowRequirement.REQUIRED, 10);
        AuthenticationExecutionEntity second =
                execution(642L, reordered, "otp-form", AuthenticationFlowRequirement.REQUIRED, 20);
        when(flowRepository.findById(64L)).thenReturn(Optional.of(reordered));
        when(executionRepository.findByIdAndFlowId(642L, 64L)).thenReturn(Optional.of(second));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(64L))
                .thenReturn(List.of(first, second));
        service.moveNode(
                64L, "EXECUTION", 642L, new AdminAuthenticationFlowNodeMoveRequestDTO("UP"));

        AuthenticationFlowEntity conditional = flow(65L, "conditional", false);
        conditional.setRequirement(AuthenticationFlowRequirement.CONDITIONAL);
        AuthenticationExecutionEntity condition =
                execution(
                        651L,
                        conditional,
                        "condition-user-configured",
                        AuthenticationFlowRequirement.REQUIRED,
                        10);
        when(flowRepository.findById(65L)).thenReturn(Optional.of(conditional));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(65L))
                .thenReturn(List.of(condition));
        service.createExecution(65L, executionRequest("OTP", "otp-form", null, 20));

        AuthenticationFlowEntity emptyConditional = flow(66L, "empty-conditional", false);
        emptyConditional.setRequirement(AuthenticationFlowRequirement.CONDITIONAL);
        when(flowRepository.findById(66L)).thenReturn(Optional.of(emptyConditional));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(66L)).thenReturn(List.of());
        service.createExecution(66L, executionRequest("OTP", "otp-form", null, 10));

        AuthenticationFlowEntity described = flow(67L, "described", false);
        when(flowRepository.findById(67L)).thenReturn(Optional.of(described));
        when(flowRepository.existsByAlias("described")).thenReturn(false);
        service.update(
                67L,
                new AdminAuthenticationFlowRequestDTO(
                        "described", "Described", "", AuthenticationFlowType.BASIC, null, null));

        assertThatThrownBy(
                        () ->
                                service.moveNode(
                                        67L,
                                        "EXECUTION",
                                        1L,
                                        new AdminAuthenticationFlowNodeMoveRequestDTO(null)))
                .hasMessageContaining("UP or DOWN");
    }

    @Test
    void coversBuiltInMetadataAlternativesAndDisabledNodes() {
        AuthenticationFlowEntity builtIn = flow(70L, "built-in", true);
        when(flowRepository.findById(70L)).thenReturn(Optional.of(builtIn));
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(70L))
                .thenReturn(List.of());
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(70L)).thenReturn(List.of());
        when(mapper.toFlowDTO(any())).thenReturn(null);
        service.update(70L, flowRequest("built-in", "built-in", null, 0));
        assertThatThrownBy(
                        () ->
                                service.update(
                                        70L,
                                        new AdminAuthenticationFlowRequestDTO(
                                                "built-in",
                                                "built-in",
                                                null,
                                                AuthenticationFlowType.FORM,
                                                null,
                                                null)))
                .hasMessageContaining("metadata");

        AuthenticationFlowEntity disabledNodeFlow = flow(71L, "disabled", false);
        AuthenticationExecutionEntity disabled =
                execution(
                        711L,
                        disabledNodeFlow,
                        "otp-form",
                        AuthenticationFlowRequirement.DISABLED,
                        10);
        when(flowRepository.findById(71L)).thenReturn(Optional.of(disabledNodeFlow));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(71L))
                .thenReturn(List.of(disabled));
        service.createExecution(71L, executionRequest("OTP", "otp-form", null, 20));

        AuthenticationFlowEntity protectedExecutionFlow = flow(72L, "protected-execution", true);
        AuthenticationExecutionEntity protectedExecution =
                execution(
                        721L,
                        protectedExecutionFlow,
                        "otp-form",
                        AuthenticationFlowRequirement.REQUIRED,
                        10);
        when(flowRepository.findById(72L)).thenReturn(Optional.of(protectedExecutionFlow));
        when(executionRepository.findByIdAndFlowId(721L, 72L))
                .thenReturn(Optional.of(protectedExecution));
        assertThatThrownBy(
                        () ->
                                service.updateExecution(
                                        72L,
                                        721L,
                                        executionRequest(
                                                "OTP", "username-password-form", null, 10)))
                .hasMessageContaining("cannot be changed");

        AuthenticationFlowEntity singleNodeFlow = flow(73L, "single-node", false);
        AuthenticationExecutionEntity singleNodeExecution =
                execution(
                        731L,
                        singleNodeFlow,
                        "otp-form",
                        AuthenticationFlowRequirement.REQUIRED,
                        10);
        when(flowRepository.findById(73L)).thenReturn(Optional.of(singleNodeFlow));
        when(executionRepository.findByIdAndFlowId(731L, 73L))
                .thenReturn(Optional.of(singleNodeExecution));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(73L))
                .thenReturn(List.of(singleNodeExecution));
        service.moveNode(
                73L, "EXECUTION", 731L, new AdminAuthenticationFlowNodeMoveRequestDTO("DOWN"));

        AuthenticationFlowEntity nameMismatch = flow(74L, "name-mismatch", true);
        when(flowRepository.findById(74L)).thenReturn(Optional.of(nameMismatch));
        assertThatThrownBy(
                        () ->
                                service.update(
                                        74L,
                                        new AdminAuthenticationFlowRequestDTO(
                                                "name-mismatch",
                                                "Changed",
                                                null,
                                                AuthenticationFlowType.BASIC,
                                                null,
                                                null)))
                .hasMessageContaining("metadata");

        AuthenticationFlowEntity descriptionMismatch = flow(75L, "description-mismatch", true);
        when(flowRepository.findById(75L)).thenReturn(Optional.of(descriptionMismatch));
        assertThatThrownBy(
                        () ->
                                service.update(
                                        75L,
                                        new AdminAuthenticationFlowRequestDTO(
                                                "description-mismatch",
                                                "description-mismatch",
                                                "Description",
                                                AuthenticationFlowType.BASIC,
                                                null,
                                                null)))
                .hasMessageContaining("metadata");

        AuthenticationFlowEntity priorityMismatch = flow(76L, "priority-mismatch", true);
        when(flowRepository.findById(76L)).thenReturn(Optional.of(priorityMismatch));
        assertThatThrownBy(
                        () ->
                                service.update(
                                        76L,
                                        flowRequest(
                                                "priority-mismatch",
                                                "priority-mismatch",
                                                null,
                                                10)))
                .hasMessageContaining("metadata");

        AuthenticationFlowEntity recursiveFlow = flow(77L, "recursive", false);
        AuthenticationFlowEntity recursiveChild = flow(78L, "recursive-child", false);
        recursiveChild.setParentFlow(recursiveFlow);
        recursiveChild.setRequirement(AuthenticationFlowRequirement.REQUIRED);
        when(flowRepository.findById(77L)).thenReturn(Optional.of(recursiveFlow));
        when(flowRepository.existsByAlias("recursive")).thenReturn(false);
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(77L))
                .thenReturn(List.of(recursiveChild));
        service.update(77L, flowRequest("recursive", "recursive", null, null));

        AuthenticationFlowEntity unchangedSubFlowParent = flow(79L, "parent", false);
        AuthenticationFlowEntity unchangedSubFlow = flow(80L, "unchanged-sub-flow", true);
        unchangedSubFlow.setParentFlow(unchangedSubFlowParent);
        unchangedSubFlow.setRequirement(AuthenticationFlowRequirement.ALTERNATIVE);
        unchangedSubFlow.setPriority(10);
        when(flowRepository.findById(80L)).thenReturn(Optional.of(unchangedSubFlow));
        when(flowRepository.existsByAlias("unchanged-sub-flow")).thenReturn(false);
        service.update(
                80L,
                new AdminAuthenticationFlowRequestDTO(
                        "unchanged-sub-flow",
                        "unchanged-sub-flow",
                        null,
                        AuthenticationFlowType.BASIC,
                        AuthenticationFlowRequirement.ALTERNATIVE,
                        10));

        AuthenticationFlowEntity conditionalWithSubFlow = flow(81L, "conditional-sub-flow", false);
        conditionalWithSubFlow.setRequirement(AuthenticationFlowRequirement.CONDITIONAL);
        conditionalWithSubFlow.setParentFlow(flow(811L, "conditional-parent", false));
        AuthenticationFlowEntity nestedSubFlow = flow(82L, "nested-sub-flow", false);
        nestedSubFlow.setParentFlow(conditionalWithSubFlow);
        nestedSubFlow.setRequirement(AuthenticationFlowRequirement.REQUIRED);
        when(flowRepository.findById(81L)).thenReturn(Optional.of(conditionalWithSubFlow));
        when(flowRepository.existsByAlias("conditional-sub-flow")).thenReturn(false);
        when(flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(81L))
                .thenReturn(List.of(nestedSubFlow));
        assertThatThrownBy(
                        () ->
                                service.update(
                                        81L,
                                        flowRequest(
                                                "conditional-sub-flow",
                                                "conditional-sub-flow",
                                                AuthenticationFlowRequirement.CONDITIONAL,
                                                null)))
                .hasMessageContaining("condition");

        AuthenticationFlowEntity conditionalWithDisabledExecution =
                flow(83L, "conditional-disabled", false);
        conditionalWithDisabledExecution.setRequirement(AuthenticationFlowRequirement.CONDITIONAL);
        AuthenticationExecutionEntity disabledExecution =
                execution(
                        831L,
                        conditionalWithDisabledExecution,
                        "otp-form",
                        AuthenticationFlowRequirement.DISABLED,
                        10);
        AuthenticationExecutionEntity requiredExecution =
                execution(
                        832L,
                        conditionalWithDisabledExecution,
                        "otp-form",
                        AuthenticationFlowRequirement.REQUIRED,
                        20);
        when(flowRepository.findById(83L))
                .thenReturn(Optional.of(conditionalWithDisabledExecution));
        when(executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(83L))
                .thenReturn(List.of(disabledExecution, requiredExecution));
        assertThatThrownBy(
                        () ->
                                service.createExecution(
                                        83L, executionRequest("OTP", "otp-form", null, 30)))
                .hasMessageContaining("condition");

        AuthenticationFlowEntity nullAliasFlow = flow(84L, "null-alias", false);
        when(flowRepository.findById(84L)).thenReturn(Optional.of(nullAliasFlow));
        when(flowRepository.existsByAlias("")).thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service.update(
                                        84L,
                                        new AdminAuthenticationFlowRequestDTO(
                                                null,
                                                "null-alias",
                                                null,
                                                AuthenticationFlowType.BASIC,
                                                null,
                                                null)))
                .hasMessageContaining("alias");
    }

    private static Answer<AuthenticationFlowEntity> assignFlowId() {
        return invocation -> {
            AuthenticationFlowEntity value = invocation.getArgument(0);
            if (value.getId() == null) {
                value.setId(100L);
            }
            return value;
        };
    }

    private static AuthenticationFlowEntity flow(Long id, String alias, boolean builtIn) {
        AuthenticationFlowEntity value = new AuthenticationFlowEntity();
        value.setId(id);
        value.setAlias(alias);
        value.setName(alias);
        value.setFlowType(AuthenticationFlowType.BASIC);
        value.setBuiltIn(builtIn);
        value.setPriority(0);
        return value;
    }

    private static AuthenticationExecutionEntity execution(
            Long id,
            AuthenticationFlowEntity flow,
            String provider,
            AuthenticationFlowRequirement requirement,
            int priority) {
        AuthenticationExecutionEntity value = new AuthenticationExecutionEntity();
        value.setId(id);
        value.setFlow(flow);
        value.setProviderId(provider);
        value.setDisplayName(provider);
        value.setRequirement(requirement);
        value.setPriority(priority);
        return value;
    }

    private static AdminAuthenticationFlowRequestDTO flowRequest(
            String alias,
            String name,
            AuthenticationFlowRequirement requirement,
            Integer priority) {
        return new AdminAuthenticationFlowRequestDTO(
                alias, name, null, AuthenticationFlowType.BASIC, requirement, priority);
    }

    private static AdminAuthenticationExecutionRequestDTO executionRequest(
            String displayName, String provider, String configuration, Integer priority) {
        return new AdminAuthenticationExecutionRequestDTO(
                provider,
                displayName,
                AuthenticationFlowRequirement.REQUIRED,
                null,
                configuration,
                priority);
    }
}
