package io.github.susimsek.kitezh.service.requiredaction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.RequiredActionCompletionEntity;
import io.github.susimsek.kitezh.domain.RequiredActionDefinitionEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.domain.UserRequiredActionEntity;
import io.github.susimsek.kitezh.dto.account.RequiredActionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRequiredActionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRequiredActionRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminUserRequiredActionDTO;
import io.github.susimsek.kitezh.mapper.RequiredActionMapper;
import io.github.susimsek.kitezh.repository.RequiredActionCompletionRepository;
import io.github.susimsek.kitezh.repository.RequiredActionDefinitionRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.repository.UserRequiredActionRepository;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiException;
import jakarta.validation.Validation;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class RequiredActionServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RequiredActionDefinitionRepository definitionRepository;
    @Mock private UserRequiredActionRepository assignmentRepository;
    @Mock private RequiredActionCompletionRepository completionRepository;
    @Mock private AdminAuditEventService auditEventService;

    @Test
    void includesGlobalAndUserAssignedActions() {
        UserEntity user = user(7L, "alice");
        user.setFirstName(null);
        user.setLastName(null);
        user.setEmail(null);
        final RequiredActionDefinitionEntity terms =
                definition("TERMS_AND_CONDITIONS", true, true, 20);
        RequiredActionDefinitionEntity profile = definition("UPDATE_PROFILE", false, false, 10);
        UserRequiredActionEntity assignment = new UserRequiredActionEntity();
        assignment.setActionKey(profile.getActionKey());
        assignment.setVersion(1);

        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(assignmentRepository.findAllByUserId(7L)).thenReturn(List.of(assignment));
        when(definitionRepository.findAllByEnabledTrueOrderByPriorityAscActionKeyAsc())
                .thenReturn(List.of(terms));
        when(definitionRepository.findById("UPDATE_PROFILE")).thenReturn(Optional.of(profile));
        when(completionRepository.findTopByUserIdAndActionKeyOrderByVersionDesc(anyLong(), any()))
                .thenReturn(Optional.empty());

        assertThat(service().pending("alice"))
                .extracting(RequiredActionDTO::key)
                .containsExactly("UPDATE_PROFILE", "TERMS_AND_CONDITIONS");
    }

    @Test
    void completesConfirmedGlobalActionAndAuditsIt() {
        UserEntity user = user(7L, "alice");
        RequiredActionDefinitionEntity terms = definition("TERMS_AND_CONDITIONS", true, true, 20);

        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user));
        when(definitionRepository.findById("TERMS_AND_CONDITIONS")).thenReturn(Optional.of(terms));
        when(definitionRepository.findAllByEnabledTrueOrderByPriorityAscActionKeyAsc())
                .thenReturn(List.of(terms));
        when(assignmentRepository.findAllByUserId(7L)).thenReturn(List.of());
        when(assignmentRepository.findByUserIdAndActionKey(7L, "TERMS_AND_CONDITIONS"))
                .thenReturn(Optional.empty());
        when(completionRepository.findTopByUserIdAndActionKeyOrderByVersionDesc(
                        7L, "TERMS_AND_CONDITIONS"))
                .thenReturn(Optional.empty());

        service()
                .complete(
                        "alice",
                        "TERMS_AND_CONDITIONS",
                        Map.of("accepted", true),
                        "127.0.0.1",
                        "test-agent");

        verify(completionRepository).save(any());
        verify(auditEventService).record("user.required-action.completed", "user", "7");
    }

    @Test
    void completesCustomActionAndReturnsFalseWhenItIsNoLongerPending() {
        UserEntity user = user(7L, "alice");
        RequiredActionDefinitionEntity definition = definition("CUSTOM_ACTION", false, true, 10);
        RequiredActionHandler handler = mock(RequiredActionHandler.class);
        when(handler.key()).thenReturn("CUSTOM_ACTION");
        when(handler.isPending(user, definition, false)).thenReturn(true);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user));
        when(definitionRepository.findById("CUSTOM_ACTION")).thenReturn(Optional.of(definition));
        when(definitionRepository.findAllByEnabledTrueOrderByPriorityAscActionKeyAsc())
                .thenReturn(List.of(definition));
        when(assignmentRepository.findAllByUserId(7L)).thenReturn(List.of());
        when(assignmentRepository.findByUserIdAndActionKey(7L, "CUSTOM_ACTION"))
                .thenReturn(Optional.empty());
        when(completionRepository.findTopByUserIdAndActionKeyOrderByVersionDesc(
                        7L, "CUSTOM_ACTION"))
                .thenReturn(Optional.empty());
        RequiredActionMapper mapper = mock(RequiredActionMapper.class);
        when(mapper.toDTO(definition, 1L))
                .thenReturn(new RequiredActionDTO("CUSTOM_ACTION", "Custom", "Description", 1L));
        when(mapper.toCompletion(any(UserEntity.class), any(), anyLong(), any(), any(), any()))
                .thenReturn(new RequiredActionCompletionEntity());

        RequiredActionService service = service(List.of(handler), mapper, null);
        assertThat(
                        service.completeInSession(
                                "alice",
                                "CUSTOM_ACTION",
                                Map.of("value", "ok"),
                                "127.0.0.1",
                                "agent",
                                "session"))
                .isTrue();
        verify(handler).complete(user, Map.of("value", "ok"));
        verify(completionRepository).save(any(RequiredActionCompletionEntity.class));

        when(handler.isPending(user, definition, false)).thenReturn(true);
        assertThat(service.completeInSession("alice", "CUSTOM_ACTION", null, null, null, null))
                .isTrue();
        verify(handler).complete(user, Map.of());

        when(handler.isPending(user, definition, false)).thenReturn(false);
        assertThat(service.completeInSession("alice", "CUSTOM_ACTION", Map.of(), null, null, null))
                .isFalse();
        verify(handler, times(1)).complete(user, Map.of());
    }

    @Test
    void rejectsCompletionOfUnassignedNonGlobalAction() {
        UserEntity user = user(7L, "alice");
        RequiredActionDefinitionEntity definition = definition("CUSTOM_ACTION", true, false, 10);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user));
        when(definitionRepository.findById("CUSTOM_ACTION")).thenReturn(Optional.of(definition));
        when(assignmentRepository.findByUserIdAndActionKey(7L, "CUSTOM_ACTION"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(
                        () ->
                                service(List.of(), null, null)
                                        .completeInSession(
                                                "alice",
                                                "CUSTOM_ACTION",
                                                Map.of(),
                                                null,
                                                null,
                                                null))
                .isInstanceOf(ApiException.class)
                .hasMessage("Required action not found");
    }

    @Test
    void usesWildcardHandlerForUnknownAction() {
        UserEntity user = user(7L, "alice");
        RequiredActionDefinitionEntity definition = definition("UNKNOWN", true, true, 1);
        RequiredActionHandler wildcard = mock(RequiredActionHandler.class);
        when(wildcard.key()).thenReturn("*");
        when(wildcard.isPending(user, definition, false)).thenReturn(false);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(assignmentRepository.findAllByUserId(7L)).thenReturn(List.of());
        when(definitionRepository.findAllByEnabledTrueOrderByPriorityAscActionKeyAsc())
                .thenReturn(List.of(definition));
        when(completionRepository.findTopByUserIdAndActionKeyOrderByVersionDesc(7L, "UNKNOWN"))
                .thenReturn(Optional.empty());

        assertThat(service(List.of(wildcard), null, null).pending("alice")).isEmpty();
        verify(wildcard).isPending(user, definition, false);
    }

    @Test
    void assignsRecoveryCodesAfterCompletingTotpWhenConfigured() {
        UserEntity user = user(7L, "alice");
        RequiredActionDefinitionEntity totp = definition("CONFIGURE_TOTP", true, true, 1);
        RequiredActionDefinitionEntity recovery = definition("RECOVERY_CODES", true, false, 2);
        RequiredActionHandler handler = mock(StandardRequiredActionHandler.class);
        when(handler.key()).thenReturn("CONFIGURE_TOTP");
        when(handler.isPending(user, totp, false)).thenReturn(true);
        RequiredActionMapper mapper = mock(RequiredActionMapper.class);
        LoginSettingsService settings = mock(LoginSettingsService.class);
        UserRequiredActionEntity assignment = new UserRequiredActionEntity();

        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user));
        when(definitionRepository.findById("CONFIGURE_TOTP")).thenReturn(Optional.of(totp));
        when(definitionRepository.findById("RECOVERY_CODES"))
                .thenReturn(Optional.of(recovery), Optional.of(recovery));
        when(definitionRepository.findAllByEnabledTrueOrderByPriorityAscActionKeyAsc())
                .thenReturn(List.of(totp));
        when(assignmentRepository.findAllByUserId(7L)).thenReturn(List.of());
        when(assignmentRepository.findByUserIdAndActionKey(7L, "CONFIGURE_TOTP"))
                .thenReturn(Optional.empty());
        when(assignmentRepository.findByUserIdAndActionKey(7L, "RECOVERY_CODES"))
                .thenReturn(Optional.empty());
        when(completionRepository.findTopByUserIdAndActionKeyOrderByVersionDesc(
                        7L, "CONFIGURE_TOTP"))
                .thenReturn(Optional.empty());
        when(mapper.toAssignment(any(), eq("RECOVERY_CODES"), eq(1L), any()))
                .thenReturn(assignment);
        when(mapper.toCompletion(any(), eq("CONFIGURE_TOTP"), eq(1L), any(), any(), any()))
                .thenReturn(new RequiredActionCompletionEntity());
        when(settings.isOtpAddRecoveryCodesEnabled()).thenReturn(true);
        when(mapper.toDTO(totp, 1L))
                .thenReturn(new RequiredActionDTO("CONFIGURE_TOTP", "TOTP", "TOTP", 1L));

        assertThat(
                        service(List.of(handler), mapper, settings)
                                .completeInSession(
                                        "alice",
                                        "CONFIGURE_TOTP",
                                        Map.of(),
                                        "127.0.0.1",
                                        "agent",
                                        null))
                .isTrue();
        verify(assignmentRepository).save(assignment);
    }

    @Test
    void listsDefinitionsAndUserActionsInPriorityOrder() {
        RequiredActionDefinitionEntity later = definition("LATER", true, false, 20);
        RequiredActionDefinitionEntity first = definition("FIRST", true, true, 10);
        RequiredActionMapper mapper = mock(RequiredActionMapper.class);
        when(mapper.toAdminDTO(first))
                .thenReturn(
                        new AdminRequiredActionDTO(
                                "FIRST", "First", "Description", true, true, 1, 10, null));
        when(mapper.toAdminDTO(later))
                .thenReturn(
                        new AdminRequiredActionDTO(
                                "LATER", "Later", "Description", true, false, 1, 20, null));
        when(definitionRepository.findAll()).thenReturn(List.of(later, first));
        when(userRepository.existsById(7L)).thenReturn(true);
        UserRequiredActionEntity assignment = new UserRequiredActionEntity();
        assignment.setActionKey("LATER");
        when(assignmentRepository.findAllByUserId(7L)).thenReturn(List.of(assignment));

        RequiredActionService service = service(List.of(), mapper, null);

        assertThat(service.definitions())
                .extracting(AdminRequiredActionDTO::key)
                .containsExactly("LATER", "FIRST");
        assertThat(service.userActions(7L))
                .extracting(AdminUserRequiredActionDTO::key)
                .containsExactly("FIRST", "LATER");
        assertThat(service.userActions(7L).get(0).assigned()).isTrue();
        assertThat(service.userActions(7L).get(1).assigned()).isTrue();
    }

    @Test
    void assignsOnlyOnceAndCanUnassignRequiredAction() {
        UserEntity user = user(7L, "alice");
        RequiredActionDefinitionEntity definition = definition("TERMS", true, false, 1);
        UserRequiredActionEntity assignment = new UserRequiredActionEntity();
        RequiredActionMapper mapper = mock(RequiredActionMapper.class);
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(definitionRepository.existsById("TERMS")).thenReturn(true);
        when(definitionRepository.findById("TERMS")).thenReturn(Optional.of(definition));
        when(assignmentRepository.findByUserIdAndActionKey(7L, "TERMS"))
                .thenReturn(Optional.empty(), Optional.of(assignment));
        when(mapper.toAssignment(any(), any(), anyLong(), any())).thenReturn(assignment);

        RequiredActionService service = service(List.of(), mapper, null);
        service.assign(7L, "TERMS", "admin");
        service.assign(7L, "TERMS", "admin");
        service.unassign(7L, "TERMS");

        verify(assignmentRepository).save(assignment);
        verify(assignmentRepository).deleteByUserIdAndActionKey(7L, "TERMS");
        verify(auditEventService).record("user.required-action.assigned", "user", "7");
        verify(auditEventService).record("user.required-action.unassigned", "user", "7");
    }

    @Test
    void rejectsMissingUsersDefinitionsAndHandlers() {
        RequiredActionMapper mapper = mock(RequiredActionMapper.class);
        RequiredActionService service = service(List.of(), mapper, null);

        when(userRepository.existsById(7L)).thenReturn(false);
        assertThatThrownBy(() -> service.userActions(7L)).isInstanceOf(RuntimeException.class);
        when(userRepository.findById(7L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.assign(7L, "TERMS", "admin"))
                .isInstanceOf(RuntimeException.class);

        UserEntity user = user(7L, "alice");
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(definitionRepository.existsById("TERMS")).thenReturn(false);
        assertThatThrownBy(() -> service.assign(7L, "TERMS", "admin"))
                .isInstanceOf(RuntimeException.class);

        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(assignmentRepository.findAllByUserId(7L)).thenReturn(List.of());
        RequiredActionDefinitionEntity unsupported = definition("UNKNOWN", true, true, 1);
        when(definitionRepository.findAllByEnabledTrueOrderByPriorityAscActionKeyAsc())
                .thenReturn(List.of(unsupported));
        when(completionRepository.findTopByUserIdAndActionKeyOrderByVersionDesc(7L, "UNKNOWN"))
                .thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.pending("alice")).isInstanceOf(RuntimeException.class);
    }

    @Test
    void updatesExistingAndNewDefinitions() {
        RequiredActionDefinitionEntity created = definition("NEW", true, false, 1);
        AdminRequiredActionRequestDTO request =
                new AdminRequiredActionRequestDTO("Name", "Description", true, false, 2, 3, "{}");
        AdminRequiredActionDTO dto =
                new AdminRequiredActionDTO("NEW", "Name", "Description", true, false, 2, 3, "{}");
        RequiredActionMapper mapper = mock(RequiredActionMapper.class);
        when(definitionRepository.findById("NEW")).thenReturn(Optional.empty());
        when(mapper.create("NEW")).thenReturn(created);
        when(definitionRepository.save(created)).thenReturn(created);
        when(mapper.toAdminDTO(created)).thenReturn(dto);

        assertThat(service(List.of(), mapper, null).updateDefinition("NEW", request))
                .isEqualTo(dto);
        verify(mapper).update(request, created);
        verify(auditEventService)
                .record("required-action.definition.updated", "required-action", "NEW");
    }

    private RequiredActionService service() {
        return service(
                List.of(
                        new StandardRequiredActionHandler(
                                Validation.buildDefaultValidatorFactory().getValidator())),
                null,
                null);
    }

    private RequiredActionService service(
            List<RequiredActionHandler> handlers,
            RequiredActionMapper mapper,
            LoginSettingsService loginSettingsService) {
        return new RequiredActionService(
                userRepository,
                definitionRepository,
                assignmentRepository,
                completionRepository,
                handlers,
                auditEventService,
                mapper == null
                        ? org.mapstruct.factory.Mappers.getMapper(RequiredActionMapper.class)
                        : mapper,
                loginSettingsService);
    }

    private static UserEntity user(Long id, String username) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setUsername(username);
        user.setEmail("alice@example.test");
        user.setFirstName("Alice");
        user.setLastName("Tester");
        return user;
    }

    private static RequiredActionDefinitionEntity definition(
            String key, boolean enabled, boolean global, int priority) {
        RequiredActionDefinitionEntity definition = new RequiredActionDefinitionEntity();
        definition.setActionKey(key);
        definition.setDisplayName(key);
        definition.setDescription(key);
        definition.setEnabled(enabled);
        definition.setGlobalPolicy(global);
        definition.setVersion(1);
        definition.setPriority(priority);
        return definition;
    }
}
