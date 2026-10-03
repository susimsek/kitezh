package io.github.susimsek.springauthserversamples.service.requiredaction;

import io.github.susimsek.springauthserversamples.domain.RequiredActionCompletionEntity;
import io.github.susimsek.springauthserversamples.domain.RequiredActionDefinitionEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.domain.UserRequiredActionEntity;
import io.github.susimsek.springauthserversamples.dto.account.RequiredActionDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRequiredActionDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRequiredActionRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminUserRequiredActionDTO;
import io.github.susimsek.springauthserversamples.mapper.RequiredActionMapper;
import io.github.susimsek.springauthserversamples.repository.RequiredActionCompletionRepository;
import io.github.susimsek.springauthserversamples.repository.RequiredActionDefinitionRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.repository.UserRequiredActionRepository;
import io.github.susimsek.springauthserversamples.service.LoginSettingsService;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
@SuppressWarnings("java:S6829")
public class RequiredActionService {

    private static final String USER_NOT_FOUND_MESSAGE = "User not found";
    private static final String REQUIRED_ACTION_NOT_FOUND_MESSAGE = "Required action not found";
    private static final String RECOVERY_CODES_ACTION = "RECOVERY_CODES";

    private final UserRepository userRepository;
    private final RequiredActionDefinitionRepository definitionRepository;
    private final UserRequiredActionRepository assignmentRepository;
    private final RequiredActionCompletionRepository completionRepository;
    private final List<RequiredActionHandler> handlers;
    private final AdminAuditEventService auditEventService;
    private final RequiredActionMapper requiredActionMapper;
    private final LoginSettingsService loginSettingsService;

    public RequiredActionService(
            UserRepository userRepository,
            RequiredActionDefinitionRepository definitionRepository,
            UserRequiredActionRepository assignmentRepository,
            RequiredActionCompletionRepository completionRepository,
            List<RequiredActionHandler> handlers,
            AdminAuditEventService auditEventService) {
        this(
                userRepository,
                definitionRepository,
                assignmentRepository,
                completionRepository,
                handlers,
                auditEventService,
                null,
                null);
    }

    public RequiredActionService(
            UserRepository userRepository,
            RequiredActionDefinitionRepository definitionRepository,
            UserRequiredActionRepository assignmentRepository,
            RequiredActionCompletionRepository completionRepository,
            List<RequiredActionHandler> handlers,
            AdminAuditEventService auditEventService,
            RequiredActionMapper requiredActionMapper) {
        this(
                userRepository,
                definitionRepository,
                assignmentRepository,
                completionRepository,
                handlers,
                auditEventService,
                requiredActionMapper,
                null);
    }

    @Transactional(readOnly = true)
    public List<RequiredActionDTO> pending(String username) {
        return pendingInternal(username);
    }

    private List<RequiredActionDTO> pendingInternal(String username) {
        UserEntity user = findUser(username);
        Map<String, UserRequiredActionEntity> assignments =
                assignmentRepository.findAllByUserId(user.getId()).stream()
                        .collect(
                                Collectors.toMap(
                                        UserRequiredActionEntity::getActionKey,
                                        Function.identity()));
        Map<String, RequiredActionDefinitionEntity> definitions =
                definitionRepository.findAllByEnabledTrueOrderByPriorityAscActionKeyAsc().stream()
                        .collect(
                                Collectors.toMap(
                                        RequiredActionDefinitionEntity::getActionKey,
                                        Function.identity()));
        assignments
                .values()
                .forEach(
                        assignment ->
                                definitions.putIfAbsent(
                                        assignment.getActionKey(),
                                        definition(assignment.getActionKey())));
        return definitions.values().stream()
                .filter(
                        definition ->
                                definition.isGlobalPolicy()
                                        || assignments.containsKey(definition.getActionKey()))
                .filter(
                        definition ->
                                isPending(
                                        user,
                                        definition,
                                        assignments.get(definition.getActionKey())))
                .sorted(Comparator.comparingInt(RequiredActionDefinitionEntity::getPriority))
                .map(
                        definition ->
                                requiredActionMapper.toDTO(
                                        definition,
                                        requiredVersion(
                                                definition,
                                                assignments.get(definition.getActionKey()))))
                .toList();
    }

    @Transactional(noRollbackFor = ApiException.class)
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void complete(
            String username,
            String actionKey,
            Map<String, Object> values,
            String ipAddress,
            String userAgent) {
        completeInSessionInternal(username, actionKey, values, ipAddress, userAgent, null);
    }

    @Transactional(noRollbackFor = ApiException.class)
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public boolean completeInSession(
            String username,
            String actionKey,
            Map<String, Object> values,
            String ipAddress,
            String userAgent,
            String currentSessionId) {
        return completeInSessionInternal(
                username, actionKey, values, ipAddress, userAgent, currentSessionId);
    }

    private boolean completeInSessionInternal(
            String username,
            String actionKey,
            Map<String, Object> values,
            String ipAddress,
            String userAgent,
            String currentSessionId) {
        UserEntity user =
                userRepository
                        .findForActionById(findUser(username).getId())
                        .orElseThrow(() -> ApiException.notFound(USER_NOT_FOUND_MESSAGE));
        RequiredActionDefinitionEntity definition = definition(actionKey);
        UserRequiredActionEntity assignment =
                assignmentRepository.findByUserIdAndActionKey(user.getId(), actionKey).orElse(null);
        final long version = requiredVersion(definition, assignment);
        if (!definition.isGlobalPolicy() && assignment == null) {
            throw ApiException.notFound(REQUIRED_ACTION_NOT_FOUND_MESSAGE);
        }
        if (pendingInternal(user.getUsername()).stream()
                .noneMatch(action -> action.key().equals(actionKey))) {
            return false;
        }
        RequiredActionHandler actionHandler = handler(actionKey);
        if (actionHandler instanceof StandardRequiredActionHandler standardHandler) {
            standardHandler.completeStandard(user, actionKey, values, currentSessionId);
        } else {
            actionHandler.complete(user, values == null ? Map.of() : values);
        }
        addRecoveryCodesActionAfterTotp(user, actionKey);
        RequiredActionCompletionEntity completion =
                requiredActionMapper.toCompletion(
                        user, actionKey, version, Instant.now(), ipAddress, userAgent);
        completionRepository.save(completion);
        auditEventService.record("user.required-action.completed", "user", user.getId().toString());
        return true;
    }

    private void addRecoveryCodesActionAfterTotp(UserEntity user, String actionKey) {
        if (!"CONFIGURE_TOTP".equals(actionKey)
                || loginSettingsService == null
                || !loginSettingsService.isOtpAddRecoveryCodesEnabled()
                || definitionRepository.findById(RECOVERY_CODES_ACTION).isEmpty()
                || assignmentRepository
                        .findByUserIdAndActionKey(user.getId(), RECOVERY_CODES_ACTION)
                        .isPresent()) {
            return;
        }
        RequiredActionDefinitionEntity recoveryDefinition =
                definitionRepository.findById(RECOVERY_CODES_ACTION).orElseThrow();
        assignmentRepository.save(
                requiredActionMapper.toAssignment(
                        user,
                        RECOVERY_CODES_ACTION,
                        recoveryDefinition.getVersion(),
                        Instant.now()));
    }

    @Transactional
    @CacheEvict(
            cacheNames = RequiredActionDefinitionRepository.ENABLED_REQUIRED_ACTIONS_CACHE,
            allEntries = true)
    public AdminRequiredActionDTO updateDefinition(
            String actionKey, AdminRequiredActionRequestDTO request) {
        RequiredActionDefinitionEntity definition =
                definitionRepository
                        .findById(actionKey)
                        .orElseGet(
                                () -> {
                                    return requiredActionMapper.create(actionKey);
                                });
        requiredActionMapper.update(request, definition);
        RequiredActionDefinitionEntity saved = definitionRepository.save(definition);
        auditEventService.record(
                "required-action.definition.updated", "required-action", actionKey);
        return toDTO(saved);
    }

    @Transactional(readOnly = true)
    public List<AdminRequiredActionDTO> definitions() {
        return definitionRepository.findAll().stream().map(this::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public List<AdminUserRequiredActionDTO> userActions(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw ApiException.notFound(USER_NOT_FOUND_MESSAGE);
        }
        var assigned =
                assignmentRepository.findAllByUserId(userId).stream()
                        .map(UserRequiredActionEntity::getActionKey)
                        .collect(Collectors.toSet());
        return definitionRepository.findAll().stream()
                .sorted(Comparator.comparingInt(RequiredActionDefinitionEntity::getPriority))
                .map(
                        definition ->
                                new AdminUserRequiredActionDTO(
                                        definition.getActionKey(),
                                        definition.getDisplayName(),
                                        definition.isEnabled(),
                                        definition.isGlobalPolicy(),
                                        assigned.contains(definition.getActionKey())
                                                || (definition.isGlobalPolicy()
                                                        && definition.isEnabled())))
                .toList();
    }

    @Transactional
    public void assign(Long userId, String actionKey, String currentUsername) {
        UserEntity user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ApiException.notFound(USER_NOT_FOUND_MESSAGE));
        if (!definitionRepository.existsById(actionKey)) {
            throw ApiException.notFound(REQUIRED_ACTION_NOT_FOUND_MESSAGE);
        }
        if (assignmentRepository.findByUserIdAndActionKey(userId, actionKey).isEmpty()) {
            UserRequiredActionEntity assignment =
                    requiredActionMapper.toAssignment(
                            user,
                            actionKey,
                            definitionRepository.findById(actionKey).orElseThrow().getVersion(),
                            Instant.now());
            assignmentRepository.save(assignment);
            auditEventService.record("user.required-action.assigned", "user", userId.toString());
        }
    }

    @Transactional
    public void unassign(Long userId, String actionKey) {
        assignmentRepository.deleteByUserIdAndActionKey(userId, actionKey);
        auditEventService.record("user.required-action.unassigned", "user", userId.toString());
    }

    private boolean isPending(
            UserEntity user,
            RequiredActionDefinitionEntity definition,
            UserRequiredActionEntity assignment) {
        long version = requiredVersion(definition, assignment);
        boolean completed =
                completionRepository
                        .findTopByUserIdAndActionKeyOrderByVersionDesc(
                                user.getId(), definition.getActionKey())
                        .map(value -> value.getVersion() >= version)
                        .orElse(false);
        return handler(definition.getActionKey()).isPending(user, definition, completed);
    }

    private long requiredVersion(
            RequiredActionDefinitionEntity definition, UserRequiredActionEntity assignment) {
        if (definition.isGlobalPolicy() || assignment == null) {
            return definition.getVersion();
        }
        return assignment.getVersion();
    }

    private RequiredActionHandler handler(String key) {
        return handlers.stream()
                .filter(value -> value.key().equals(key))
                .findFirst()
                .orElseGet(
                        () ->
                                handlers.stream()
                                        .filter(value -> value.key().equals("*"))
                                        .findFirst()
                                        .orElseThrow(
                                                () ->
                                                        ApiException.badRequest(
                                                                ApiErrorCode.ACTION_UNSUPPORTED,
                                                                "No required action handler is"
                                                                        + " registered")));
    }

    private RequiredActionDefinitionEntity definition(String key) {
        return definitionRepository
                .findById(key)
                .orElseThrow(() -> ApiException.notFound(REQUIRED_ACTION_NOT_FOUND_MESSAGE));
    }

    private UserEntity findUser(String username) {
        return userRepository
                .findByUsername(username)
                .orElseThrow(() -> ApiException.notFound(USER_NOT_FOUND_MESSAGE));
    }

    private AdminRequiredActionDTO toDTO(RequiredActionDefinitionEntity definition) {
        return requiredActionMapper.toAdminDTO(definition);
    }
}
