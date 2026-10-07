package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.AuthenticationExecutionEntity;
import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingEntity;
import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingType;
import io.github.susimsek.kitezh.domain.AuthenticationFlowEntity;
import io.github.susimsek.kitezh.domain.AuthenticationFlowNodeType;
import io.github.susimsek.kitezh.domain.AuthenticationFlowRequirement;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationExecutionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationExecutionRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowBindingDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowBindingRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowCopyRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowDetailDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowNodeDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowNodeMoveRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowRequestDTO;
import io.github.susimsek.kitezh.mapper.AuthenticationFlowMapper;
import io.github.susimsek.kitezh.repository.AuthenticationExecutionRepository;
import io.github.susimsek.kitezh.repository.AuthenticationFlowBindingRepository;
import io.github.susimsek.kitezh.repository.AuthenticationFlowRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
@RequiredArgsConstructor
public class AuthenticationFlowService {

    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();
    private static final String AUTHENTICATION_FLOW_RESOURCE = "authentication-flow";
    private static final String AUTHENTICATION_NODE_NOT_FOUND = "Authentication node not found";

    private static final Set<String> EXECUTION_PROVIDERS =
            Set.of(
                    "cookie",
                    "identity-provider-redirector",
                    "username-password-form",
                    "otp-form",
                    "webauthn-passwordless",
                    "webauthn-authenticator",
                    "registration-user-creation",
                    "registration-profile-action",
                    "reset-credentials-email",
                    "reset-password",
                    "verify-existing-account",
                    "create-user-if-unique",
                    "user-session-limits",
                    "condition-user-configured");

    private final AuthenticationFlowRepository flowRepository;
    private final AuthenticationExecutionRepository executionRepository;
    private final AuthenticationFlowBindingRepository bindingRepository;
    private final AuthenticationFlowMapper mapper;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public Page<AdminAuthenticationFlowDTO> topLevelFlows(Pageable pageable) {
        return flowRepository.findByParentFlowIsNull(pageable).map(mapper::toFlowDTO);
    }

    @Transactional(readOnly = true)
    public AdminAuthenticationFlowDetailDTO flow(Long flowId) {
        return flowInternal(flowId);
    }

    private AdminAuthenticationFlowDetailDTO flowInternal(Long flowId) {
        AuthenticationFlowEntity flow = findFlow(flowId);
        List<AdminAuthenticationExecutionDTO> executions =
                executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(flowId).stream()
                        .map(mapper::toExecutionDTO)
                        .toList();
        List<AdminAuthenticationFlowDTO> subFlows =
                flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(flowId).stream()
                        .map(mapper::toFlowDTO)
                        .toList();
        List<AdminAuthenticationFlowNodeDTO> nodes =
                nodes(flow).stream().map(this::toNodeDTO).toList();
        return new AdminAuthenticationFlowDetailDTO(
                mapper.toFlowDTO(flow), executions, subFlows, nodes);
    }

    @Transactional
    public AdminAuthenticationFlowDTO create(AdminAuthenticationFlowRequestDTO request) {
        validateAlias(request.alias(), null);
        if (request.requirement() != null) {
            throw invalid("Top-level flows cannot have a requirement");
        }
        AuthenticationFlowEntity flow = new AuthenticationFlowEntity();
        apply(flow, request, null);
        flow.setPriority(0);
        AuthenticationFlowEntity saved = flowRepository.save(flow);
        validateGraph(saved);
        auditEventService.record(
                "authentication-flow.created",
                AUTHENTICATION_FLOW_RESOURCE,
                saved.getId().toString());
        return mapper.toFlowDTO(saved);
    }

    @Transactional
    public AdminAuthenticationFlowDTO createSubFlow(
            Long parentId, AdminAuthenticationFlowRequestDTO request) {
        AuthenticationFlowEntity parent = findFlow(parentId);
        ensureStructureMutable(parent);
        validateAlias(request.alias(), null);
        if (request.requirement() == null) {
            throw invalid("A sub-flow requirement is required");
        }
        AuthenticationFlowEntity flow = new AuthenticationFlowEntity();
        apply(flow, request, parent);
        flow.setPriority(nextPriority(parentId));
        AuthenticationFlowEntity saved = flowRepository.save(flow);
        validateGraph(parent);
        auditEventService.record(
                "authentication-flow.subflow.created",
                AUTHENTICATION_FLOW_RESOURCE,
                saved.getId().toString());
        return mapper.toFlowDTO(saved);
    }

    @Transactional
    public AdminAuthenticationFlowDTO update(
            Long flowId, AdminAuthenticationFlowRequestDTO request) {
        AuthenticationFlowEntity flow = findFlow(flowId);
        validateAlias(request.alias(), flow.getAlias());
        if (flow.isTopLevel() && request.requirement() != null) {
            throw invalid("Top-level flows cannot have a requirement");
        }
        if (!flow.isTopLevel() && request.requirement() == null) {
            throw invalid("A sub-flow requirement is required");
        }
        if (flow.isBuiltIn()) {
            ensureBuiltInFlowMetadataUnchanged(flow, request);
        }
        apply(flow, request, flow.getParentFlow());
        flow.setPriority(
                request.priority() == null ? flow.getPriority() : nonNegative(request.priority()));
        AuthenticationFlowEntity saved = flowRepository.save(flow);
        validateGraph(flow);
        auditEventService.record(
                "authentication-flow.updated",
                AUTHENTICATION_FLOW_RESOURCE,
                saved.getId().toString());
        return mapper.toFlowDTO(saved);
    }

    @Transactional
    public void delete(Long flowId) {
        AuthenticationFlowEntity flow = findFlow(flowId);
        if (flow.isBuiltIn()) {
            throw conflict("Built-in flows cannot be deleted");
        }
        if (flowRepository.existsByParentFlowId(flowId)
                || executionRepository.existsByFlowId(flowId)) {
            throw conflict("Delete the flow's sub-flows and executions first");
        }
        if (bindingRepository.existsByFlowId(flowId)) {
            throw conflict("Unbind the flow before deleting it");
        }
        flowRepository.delete(flow);
        auditEventService.record(
                "authentication-flow.deleted", AUTHENTICATION_FLOW_RESOURCE, flowId.toString());
    }

    @Transactional
    public AdminAuthenticationExecutionDTO createExecution(
            Long flowId, AdminAuthenticationExecutionRequestDTO request) {
        AuthenticationFlowEntity flow = findFlow(flowId);
        ensureStructureMutable(flow);
        validateProvider(request.providerId());
        validateExecutionRequirement(request.requirement());
        validateConfiguration(request.configuration());
        AuthenticationExecutionEntity execution = new AuthenticationExecutionEntity();
        execution.setFlow(flow);
        apply(execution, request);
        execution.setPriority(
                request.priority() == null
                        ? nextPriority(flowId)
                        : nonNegative(request.priority()));
        AuthenticationExecutionEntity saved = executionRepository.save(execution);
        validateGraph(flow);
        auditEventService.record(
                "authentication-execution.created",
                AUTHENTICATION_FLOW_RESOURCE,
                flowId.toString());
        return mapper.toExecutionDTO(saved);
    }

    @Transactional
    public AdminAuthenticationExecutionDTO updateExecution(
            Long flowId, Long executionId, AdminAuthenticationExecutionRequestDTO request) {
        validateProvider(request.providerId());
        validateExecutionRequirement(request.requirement());
        validateConfiguration(request.configuration());
        AuthenticationFlowEntity flow = findFlow(flowId);
        AuthenticationExecutionEntity execution =
                executionRepository
                        .findByIdAndFlowId(executionId, flowId)
                        .orElseThrow(
                                () -> ApiException.notFound("Authentication execution not found"));
        if (flow.isBuiltIn()
                && (!execution.getProviderId().equalsIgnoreCase(request.providerId().trim())
                        || !execution.getDisplayName().equals(request.displayName().trim()))) {
            throw conflict("Built-in execution providers and names cannot be changed");
        }
        apply(execution, request);
        execution.setPriority(
                request.priority() == null
                        ? execution.getPriority()
                        : nonNegative(request.priority()));
        AuthenticationExecutionEntity saved = executionRepository.save(execution);
        validateGraph(flow);
        auditEventService.record(
                "authentication-execution.updated",
                AUTHENTICATION_FLOW_RESOURCE,
                flowId.toString());
        return mapper.toExecutionDTO(saved);
    }

    @Transactional
    public void deleteExecution(Long flowId, Long executionId) {
        AuthenticationFlowEntity flow = findFlow(flowId);
        ensureStructureMutable(flow);
        AuthenticationExecutionEntity execution =
                executionRepository
                        .findByIdAndFlowId(executionId, flowId)
                        .orElseThrow(
                                () -> ApiException.notFound("Authentication execution not found"));
        executionRepository.delete(execution);
        validateGraph(flow);
        auditEventService.record(
                "authentication-execution.deleted",
                AUTHENTICATION_FLOW_RESOURCE,
                flowId.toString());
    }

    @Transactional
    public AdminAuthenticationFlowDetailDTO moveNode(
            Long flowId,
            String nodeType,
            Long nodeId,
            AdminAuthenticationFlowNodeMoveRequestDTO request) {
        AuthenticationFlowEntity parent = findFlow(flowId);
        ensureStructureMutable(parent);
        boolean up = direction(request.direction());
        List<Node> nodes = nodes(parent);
        Node selected =
                "EXECUTION".equalsIgnoreCase(nodeType)
                        ? Node.execution(
                                executionRepository
                                        .findByIdAndFlowId(nodeId, flowId)
                                        .orElseThrow(
                                                () ->
                                                        ApiException.notFound(
                                                                AUTHENTICATION_NODE_NOT_FOUND)))
                        : Node.subFlow(
                                flowRepository
                                        .findAllByParentFlowIdOrderByPriorityAscIdAsc(flowId)
                                        .stream()
                                        .filter(value -> value.getId().equals(nodeId))
                                        .findFirst()
                                        .orElseThrow(
                                                () ->
                                                        ApiException.notFound(
                                                                AUTHENTICATION_NODE_NOT_FOUND)));
        int index =
                java.util.stream.IntStream.range(0, nodes.size())
                        .filter(value -> nodes.get(value).sameNode(selected))
                        .findFirst()
                        .orElseThrow(() -> ApiException.notFound(AUTHENTICATION_NODE_NOT_FOUND));
        int targetIndex = up ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < nodes.size()) {
            Node current = nodes.get(index);
            Node target = nodes.get(targetIndex);
            int currentPriority = current.priority();
            int targetPriority = target.priority();
            current.setPriority(targetPriority);
            target.setPriority(currentPriority);
            saveNode(current);
            saveNode(target);
            auditEventService.record(
                    "authentication-flow.node.reordered",
                    AUTHENTICATION_FLOW_RESOURCE,
                    flowId.toString());
        }
        return flowInternal(parent.getId());
    }

    @Transactional
    public AdminAuthenticationFlowDTO duplicate(
            Long sourceId, AdminAuthenticationFlowCopyRequestDTO request) {
        AuthenticationFlowEntity source = findFlow(sourceId);
        validateAlias(request.alias(), null);
        AuthenticationFlowEntity copy = copyFlow(source, request, null, false);
        AuthenticationFlowEntity saved = flowRepository.save(copy);
        copyChildren(source, saved);
        validateGraph(saved);
        auditEventService.record(
                "authentication-flow.duplicated",
                AUTHENTICATION_FLOW_RESOURCE,
                saved.getId().toString());
        return mapper.toFlowDTO(saved);
    }

    @Transactional(readOnly = true)
    public List<AdminAuthenticationFlowBindingDTO> bindings() {
        return java.util.Arrays.stream(AuthenticationFlowBindingType.values())
                .map(this::binding)
                .toList();
    }

    @Transactional
    public AdminAuthenticationFlowBindingDTO bind(
            AuthenticationFlowBindingType bindingType,
            AdminAuthenticationFlowBindingRequestDTO request) {
        AuthenticationFlowEntity flow = findFlow(request.flowId());
        if (!flow.isTopLevel()) {
            throw invalid("Only top-level flows can be bound");
        }
        AuthenticationFlowBindingEntity binding =
                bindingRepository
                        .findById(bindingType)
                        .orElseGet(AuthenticationFlowBindingEntity::new);
        binding.setBindingType(bindingType);
        binding.setFlow(flow);
        bindingRepository.save(binding);
        auditEventService.record(
                "authentication-flow.binding.updated",
                "authentication-flow-binding",
                bindingType.name());
        return binding(bindingType);
    }

    @Transactional
    public AdminAuthenticationFlowBindingDTO unbind(AuthenticationFlowBindingType bindingType) {
        AuthenticationFlowBindingEntity binding =
                bindingRepository
                        .findById(bindingType)
                        .orElseGet(AuthenticationFlowBindingEntity::new);
        binding.setBindingType(bindingType);
        binding.setFlow(null);
        bindingRepository.save(binding);
        auditEventService.record(
                "authentication-flow.binding.removed",
                "authentication-flow-binding",
                bindingType.name());
        return binding(bindingType);
    }

    @Transactional(readOnly = true)
    public List<String> executionProviders() {
        return EXECUTION_PROVIDERS.stream().sorted().toList();
    }

    private AdminAuthenticationFlowBindingDTO binding(AuthenticationFlowBindingType bindingType) {
        AuthenticationFlowBindingEntity value =
                bindingRepository.findById(bindingType).orElse(null);
        AuthenticationFlowEntity flow = value == null ? null : value.getFlow();
        return new AdminAuthenticationFlowBindingDTO(
                bindingType,
                flow == null ? null : flow.getId(),
                flow == null ? null : flow.getAlias(),
                flow == null ? null : flow.getName());
    }

    private List<Node> nodes(AuthenticationFlowEntity flow) {
        return java.util.stream.Stream.concat(
                        executionRepository
                                .findAllByFlowIdOrderByPriorityAscIdAsc(flow.getId())
                                .stream()
                                .map(Node::execution),
                        flowRepository
                                .findAllByParentFlowIdOrderByPriorityAscIdAsc(flow.getId())
                                .stream()
                                .map(Node::subFlow))
                .sorted(Comparator.comparingInt(Node::priority).thenComparing(Node::id))
                .toList();
    }

    private void saveNode(Node node) {
        if (node.execution() != null) {
            executionRepository.save(node.execution());
        } else {
            flowRepository.save(node.subFlow());
        }
    }

    private AuthenticationFlowEntity findFlow(Long id) {
        return flowRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Authentication flow not found"));
    }

    private void apply(
            AuthenticationFlowEntity flow,
            AdminAuthenticationFlowRequestDTO request,
            AuthenticationFlowEntity parent) {
        flow.setAlias(request.alias().trim());
        flow.setName(request.name().trim());
        flow.setDescription(trimToNull(request.description()));
        flow.setFlowType(request.flowType());
        flow.setParentFlow(parent);
        flow.setRequirement(parent == null ? null : request.requirement());
        flow.setBuiltIn(flow.isBuiltIn());
    }

    private static void apply(
            AuthenticationExecutionEntity execution,
            AdminAuthenticationExecutionRequestDTO request) {
        execution.setProviderId(request.providerId().trim().toLowerCase(Locale.ROOT));
        execution.setDisplayName(request.displayName().trim());
        execution.setRequirement(request.requirement());
        execution.setAuthenticatorReference(trimToNull(request.authenticatorReference()));
        execution.setConfiguration(trimToNull(request.configuration()));
    }

    private int nextPriority(Long flowId) {
        int executionPriority =
                executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(flowId).stream()
                        .mapToInt(AuthenticationExecutionEntity::getPriority)
                        .max()
                        .orElse(0);
        int childPriority =
                flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(flowId).stream()
                        .mapToInt(AuthenticationFlowEntity::getPriority)
                        .max()
                        .orElse(0);
        return Math.max(executionPriority, childPriority) + 10;
    }

    private static int nonNegative(int priority) {
        if (priority < 0) {
            throw invalid("Priority cannot be negative");
        }
        return priority;
    }

    private void validateAlias(String alias, String currentAlias) {
        String value = alias == null ? "" : alias.trim();
        if (!value.equals(currentAlias) && flowRepository.existsByAlias(value)) {
            throw ApiException.conflict(
                    "alias", ApiErrorCode.CONFLICT, "Flow alias is already registered");
        }
    }

    private static void validateProvider(String providerId) {
        if (providerId == null
                || !EXECUTION_PROVIDERS.contains(providerId.trim().toLowerCase(Locale.ROOT))) {
            throw invalid("Authenticator provider is not supported");
        }
    }

    private static void validateExecutionRequirement(AuthenticationFlowRequirement requirement) {
        if (requirement == AuthenticationFlowRequirement.CONDITIONAL) {
            throw invalid("Conditional is only valid for sub-flows");
        }
    }

    private static void validateConfiguration(String configuration) {
        String value = trimToNull(configuration);
        if (value == null) {
            return;
        }
        try {
            if (!JSON_MAPPER.readTree(value).isObject()) {
                throw invalid("Execution configuration must be a JSON object");
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception _) {
            throw invalid("Execution configuration must be valid JSON");
        }
    }

    private void ensureStructureMutable(AuthenticationFlowEntity flow) {
        if (flow.isBuiltIn()) {
            throw conflict("Built-in flow structure cannot be changed");
        }
    }

    private static void ensureBuiltInFlowMetadataUnchanged(
            AuthenticationFlowEntity flow, AdminAuthenticationFlowRequestDTO request) {
        if (!flow.getAlias().equals(request.alias().trim())
                || !flow.getName().equals(request.name().trim())
                || flow.getFlowType() != request.flowType()
                || !Objects.equals(flow.getDescription(), trimToNull(request.description()))
                || (request.priority() != null && flow.getPriority() != request.priority())
                || (!flow.isTopLevel() && flow.getRequirement() != request.requirement())) {
            throw conflict("Built-in flow metadata cannot be changed");
        }
    }

    private void validateGraph(AuthenticationFlowEntity flow) {
        validateSiblingRequirements(flow);
        List<AuthenticationFlowEntity> children =
                flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(flow.getId());
        for (AuthenticationFlowEntity child : children) {
            validateGraph(child);
        }
    }

    private void validateSiblingRequirements(AuthenticationFlowEntity flow) {
        List<AuthenticationFlowRequirement> requirements =
                nodes(flow).stream()
                        .map(this::requirement)
                        .filter(value -> value != AuthenticationFlowRequirement.DISABLED)
                        .toList();
        boolean required = requirements.contains(AuthenticationFlowRequirement.REQUIRED);
        boolean alternative = requirements.contains(AuthenticationFlowRequirement.ALTERNATIVE);
        if (required && alternative) {
            throw invalid("A flow level cannot mix REQUIRED and ALTERNATIVE nodes");
        }
        if (flow.getRequirement() == AuthenticationFlowRequirement.CONDITIONAL
                && !requirements.isEmpty()
                && nodes(flow).stream()
                        .filter(node -> requirement(node) != AuthenticationFlowRequirement.DISABLED)
                        .noneMatch(this::isConditionNode)) {
            throw invalid("A conditional sub-flow must contain a condition execution");
        }
    }

    private AuthenticationFlowRequirement requirement(Node node) {
        return node.execution() == null
                ? node.subFlow().getRequirement()
                : node.execution().getRequirement();
    }

    private boolean isConditionNode(Node node) {
        return node.execution() != null
                && node.execution().getProviderId().startsWith("condition-");
    }

    private AdminAuthenticationFlowNodeDTO toNodeDTO(Node node) {
        if (node.execution() != null) {
            AuthenticationExecutionEntity execution = node.execution();
            return new AdminAuthenticationFlowNodeDTO(
                    AuthenticationFlowNodeType.EXECUTION,
                    execution.getId(),
                    execution.getDisplayName(),
                    execution.getProviderId(),
                    execution.getRequirement(),
                    execution.getPriority(),
                    execution.getFlow().isBuiltIn());
        }
        AuthenticationFlowEntity subFlow = node.subFlow();
        return new AdminAuthenticationFlowNodeDTO(
                AuthenticationFlowNodeType.SUB_FLOW,
                subFlow.getId(),
                subFlow.getName(),
                null,
                subFlow.getRequirement(),
                subFlow.getPriority(),
                subFlow.isBuiltIn());
    }

    private AuthenticationFlowEntity copyFlow(
            AuthenticationFlowEntity source,
            AdminAuthenticationFlowCopyRequestDTO request,
            AuthenticationFlowEntity parent,
            boolean builtIn) {
        AuthenticationFlowEntity copy = new AuthenticationFlowEntity();
        copy.setAlias(request.alias().trim());
        copy.setName(request.name().trim());
        copy.setDescription(trimToNull(request.description()));
        copy.setFlowType(source.getFlowType());
        copy.setBuiltIn(builtIn);
        copy.setParentFlow(parent);
        copy.setRequirement(parent == null ? null : source.getRequirement());
        copy.setPriority(parent == null ? 0 : source.getPriority());
        return copy;
    }

    private void copyChildren(AuthenticationFlowEntity source, AuthenticationFlowEntity target) {
        for (AuthenticationFlowEntity sourceChild :
                flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(source.getId())) {
            AuthenticationFlowEntity child = new AuthenticationFlowEntity();
            child.setAlias(uniqueAlias(sourceChild.getAlias() + "-copy"));
            child.setName(sourceChild.getName());
            child.setDescription(sourceChild.getDescription());
            child.setFlowType(sourceChild.getFlowType());
            child.setBuiltIn(false);
            child.setParentFlow(target);
            child.setRequirement(sourceChild.getRequirement());
            child.setPriority(sourceChild.getPriority());
            AuthenticationFlowEntity savedChild = flowRepository.save(child);
            copyExecutions(sourceChild, savedChild);
            copyChildren(sourceChild, savedChild);
        }
        copyExecutions(source, target);
    }

    private void copyExecutions(AuthenticationFlowEntity source, AuthenticationFlowEntity target) {
        for (AuthenticationExecutionEntity sourceExecution :
                executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(source.getId())) {
            AuthenticationExecutionEntity execution = new AuthenticationExecutionEntity();
            execution.setFlow(target);
            execution.setProviderId(sourceExecution.getProviderId());
            execution.setDisplayName(sourceExecution.getDisplayName());
            execution.setRequirement(sourceExecution.getRequirement());
            execution.setPriority(sourceExecution.getPriority());
            execution.setAuthenticatorReference(sourceExecution.getAuthenticatorReference());
            execution.setConfiguration(sourceExecution.getConfiguration());
            executionRepository.save(execution);
        }
    }

    private String uniqueAlias(String baseAlias) {
        String alias = baseAlias;
        int suffix = 2;
        while (flowRepository.existsByAlias(alias)) {
            alias = baseAlias + "-" + suffix++;
        }
        return alias;
    }

    private static boolean direction(String value) {
        String direction = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if ("UP".equals(direction)) {
            return true;
        }
        if ("DOWN".equals(direction)) {
            return false;
        }
        throw invalid("Direction must be UP or DOWN");
    }

    private static String trimToNull(String value) {
        String trimmed = value == null ? null : value.trim();
        return trimmed == null || trimmed.isEmpty() ? null : trimmed;
    }

    private static ApiException invalid(String message) {
        return ApiException.badRequest(ApiErrorCode.INVALID_REQUEST, message);
    }

    private static ApiException conflict(String message) {
        return ApiException.conflict(ApiErrorCode.CONFLICT, message);
    }

    private static final class Node {

        private final AuthenticationExecutionEntity execution;
        private final AuthenticationFlowEntity subFlow;
        private int priority;

        private Node(
                AuthenticationExecutionEntity execution,
                AuthenticationFlowEntity subFlow,
                int priority) {
            this.execution = execution;
            this.subFlow = subFlow;
            this.priority = priority;
        }

        static Node execution(AuthenticationExecutionEntity value) {
            return new Node(value, null, value.getPriority());
        }

        AuthenticationExecutionEntity execution() {
            return execution;
        }

        static Node subFlow(AuthenticationFlowEntity value) {
            return new Node(null, value, value.getPriority());
        }

        AuthenticationFlowEntity subFlow() {
            return subFlow;
        }

        Long id() {
            return execution == null ? subFlow.getId() : execution.getId();
        }

        int priority() {
            return priority;
        }

        void setPriority(int value) {
            priority = value;
            if (execution == null) {
                subFlow.setPriority(value);
            } else {
                execution.setPriority(value);
            }
        }

        boolean sameNode(Node other) {
            return execution != null
                    ? other.execution != null && execution.getId().equals(other.execution.getId())
                    : other.subFlow != null && subFlow.getId().equals(other.subFlow.getId());
        }
    }
}
