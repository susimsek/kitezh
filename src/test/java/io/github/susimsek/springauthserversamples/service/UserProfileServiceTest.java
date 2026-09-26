package io.github.susimsek.springauthserversamples.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.domain.UserProfileAttributeDefinitionEntity;
import io.github.susimsek.springauthserversamples.domain.UserProfileAttributeType;
import io.github.susimsek.springauthserversamples.dto.userprofile.UserProfileAttributeDefinitionRequestDTO;
import io.github.susimsek.springauthserversamples.dto.userprofile.UserProfileAttributeOrderRequestDTO;
import io.github.susimsek.springauthserversamples.repository.UserProfileAttributeDefinitionRepository;
import io.github.susimsek.springauthserversamples.repository.UserProfileAttributeRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.admin.UserAccessInvalidationService;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import jakarta.persistence.EntityManager;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class UserProfileServiceTest {

    @Mock private UserProfileAttributeDefinitionRepository definitionRepository;
    @Mock private UserProfileAttributeRepository attributeRepository;
    @Mock private UserRepository userRepository;
    @Mock private AdminAuditEventService auditEventService;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;
    @Mock private EntityManager entityManager;

    @Test
    void rejectsReservedAndInvalidDefinitionNames() {
        UserProfileService service = service();

        assertThatThrownBy(() -> service.create(request("email", UserProfileAttributeType.STRING)))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.USER_PROFILE_INVALID_NAME);

        assertThatThrownBy(
                        () ->
                                service.create(
                                        new UserProfileAttributeDefinitionRequestDTO(
                                                "department",
                                                "Department",
                                                null,
                                                UserProfileAttributeType.STRING,
                                                false,
                                                false,
                                                10,
                                                2,
                                                null,
                                                true,
                                                0)))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.USER_PROFILE_INVALID_DEFINITION);
    }

    @Test
    void rejectsMissingRequiredAndInvalidTypedValues() {
        UserProfileAttributeDefinitionEntity definition = definition("age", true);
        definition.setType(UserProfileAttributeType.INTEGER);
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(definition));

        final UserEntity user = user();
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        UserProfileService service = service();

        assertThatThrownBy(() -> service.saveAttributes(7L, Map.of(), "admin"))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.USER_PROFILE_REQUIRED);

        assertThatThrownBy(
                        () ->
                                service.saveAttributes(
                                        7L, Map.of("age", List.of("not-a-number")), "admin"))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.USER_PROFILE_INVALID_VALUE);
    }

    @Test
    void savesNormalizedValuesAndInvalidatesAccess() {
        UserProfileAttributeDefinitionEntity definition = definition("department", false);
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(definition));
        when(definitionRepository.findAllByOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(definition));
        when(attributeRepository
                        .findAllByUserIdOrderByDefinitionDisplayOrderAscDefinitionNameAscPositionAsc(
                                7L))
                .thenReturn(List.of());
        final UserEntity user = user();
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));

        var result =
                service().saveAttributes(7L, Map.of("department", List.of("  Finance  ")), "admin");

        assertThat(result.definitions()).hasSize(1);
        verify(attributeRepository).deleteAllByUserId(7L);
        ArgumentCaptor<List> savedValues = ArgumentCaptor.forClass(List.class);
        verify(attributeRepository).saveAll(savedValues.capture());
        assertThat(savedValues.getValue()).hasSize(1);
        verify(userAccessInvalidationService).invalidate("alice");
        verify(auditEventService).record("user-profile.attributes.updated", "user", "7");
    }

    @Test
    void searchesPagedProfileDefinitions() {
        UserProfileAttributeDefinitionEntity definition = definition("department", false);
        var pageable = PageRequest.of(1, 10);
        when(definitionRepository.findByNameContainingIgnoreCaseOrDisplayNameContainingIgnoreCase(
                        "dep", "dep", pageable))
                .thenReturn(
                        new org.springframework.data.domain.PageImpl<>(
                                List.of(definition), pageable, 11));

        var result = service().definitions("  dep  ", pageable);

        assertThat(result.getTotalElements()).isEqualTo(11);
        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    void reordersProfileDefinitionsAndAuditsTheChange() {
        UserProfileAttributeDefinitionEntity first = definition("first", false);
        first.setId(1L);
        first.setDisplayOrder(10);
        UserProfileAttributeDefinitionEntity second = definition("second", false);
        second.setId(2L);
        second.setDisplayOrder(20);
        when(definitionRepository.findAllById(List.of(2L, 1L))).thenReturn(List.of(first, second));
        when(definitionRepository.findAllByOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(second, first));

        var result = service().reorder(new UserProfileAttributeOrderRequestDTO(List.of(2L, 1L)));

        assertThat(second.getDisplayOrder()).isEqualTo(10);
        assertThat(first.getDisplayOrder()).isEqualTo(11);
        assertThat(result).extracting("name").containsExactly("second", "first");
        verify(definitionRepository).saveAll(List.of(first, second));
        verify(auditEventService)
                .record("user-profile.attributes.reordered", "user-profile-attributes", "order");
    }

    @Test
    void coversDefinitionLifecycleAndValidationBranches() {
        UserProfileAttributeDefinitionEntity definition = definition("department", false);
        when(definitionRepository.findByNameIgnoreCase("department")).thenReturn(Optional.empty());
        when(definitionRepository.save(any()))
                .thenAnswer(
                        invocation -> {
                            UserProfileAttributeDefinitionEntity saved = invocation.getArgument(0);
                            saved.setId(8L);
                            return saved;
                        });
        var created = service().create(request(" department ", UserProfileAttributeType.STRING));
        assertThat(created.name()).isEqualTo("department");
        verify(auditEventService)
                .record("user-profile.attribute.created", "user-profile-attribute", "8");

        when(definitionRepository.findByNameIgnoreCase("department"))
                .thenReturn(Optional.of(definition));
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                request(
                                                        "department",
                                                        UserProfileAttributeType.STRING)))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.USER_PROFILE_DUPLICATE_NAME);
        assertThatThrownBy(() -> service().create(requestWithPattern("new-field", "[")))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.USER_PROFILE_INVALID_DEFINITION);
    }

    @Test
    void updatesAndDeletesCustomAndBuiltInDefinitions() {
        UserProfileAttributeDefinitionEntity custom = definition("department", false);
        custom.setId(9L);
        when(definitionRepository.findById(9L)).thenReturn(Optional.of(custom));
        when(definitionRepository.findByNameIgnoreCase("department"))
                .thenReturn(Optional.of(custom));
        service().update(9L, request("department", UserProfileAttributeType.STRING));
        verify(auditEventService)
                .record("user-profile.attribute.updated", "user-profile-attribute", "9");

        UserProfileAttributeDefinitionEntity other = definition("other", false);
        other.setId(11L);
        when(definitionRepository.findByNameIgnoreCase("other"))
                .thenReturn(Optional.of(other), Optional.empty());
        assertThatThrownBy(
                        () ->
                                service()
                                        .update(
                                                9L,
                                                request("other", UserProfileAttributeType.STRING)))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.USER_PROFILE_DUPLICATE_NAME);

        UserProfileAttributeDefinitionEntity builtIn = definition("email", false);
        builtIn.setId(10L);
        when(definitionRepository.findById(10L)).thenReturn(Optional.of(builtIn));
        assertThatThrownBy(
                        () ->
                                service()
                                        .update(
                                                10L,
                                                request("other", UserProfileAttributeType.STRING)))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.USER_PROFILE_INVALID_NAME);

        when(definitionRepository.findById(9L)).thenReturn(Optional.of(custom));
        when(attributeRepository.existsByDefinitionId(9L)).thenReturn(true);
        service().delete(9L);
        verify(attributeRepository).deleteAllByDefinitionId(9L);
        verify(definitionRepository).delete(custom);
        when(definitionRepository.findById(10L)).thenReturn(Optional.of(builtIn));
        assertThatThrownBy(() -> service().delete(10L))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.USER_PROFILE_INVALID_NAME);

        when(definitionRepository.findById(9L)).thenReturn(Optional.of(custom));
        when(attributeRepository.existsByDefinitionId(9L)).thenReturn(false);
        service().delete(9L);
    }

    @Test
    void coversNullMappedValuesAndRemainingTypedValidationBranches() {
        final UserEntity user = user();
        UserProfileAttributeDefinitionEntity department = definition("department", false);
        department.setId(12L);
        department.setPattern("[a-z]+");
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(department));

        Map<String, List<String>> mapped = new java.util.LinkedHashMap<>();
        mapped.put("department", null);
        service().mergeMappedAttributes(user, mapped, "provider");

        assertThatThrownBy(
                        () ->
                                service()
                                        .saveAttributes(
                                                7L,
                                                Map.of("department", List.of("not-matching")),
                                                "admin"))
                .isInstanceOf(ApiException.class);

        department.setPattern(" ");
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(department));
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        service().saveAttributes(7L, Map.of("department", List.of("anything")), "admin");

        UserProfileAttributeDefinitionEntity email = definition("emailValue", false);
        email.setType(UserProfileAttributeType.EMAIL);
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(email));
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        for (String invalid : List.of("@example.com", "user@example.com@")) {
            assertThatThrownBy(
                            () ->
                                    service()
                                            .saveAttributes(
                                                    7L,
                                                    Map.of("emailValue", List.of(invalid)),
                                                    "admin"))
                    .isInstanceOf(ApiException.class);
        }

        UserProfileAttributeDefinitionEntity bool = definition("flag", false);
        bool.setType(UserProfileAttributeType.BOOLEAN);
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(bool));
        assertThatThrownBy(
                        () ->
                                service()
                                        .saveAttributes(
                                                7L, Map.of("flag", List.of("maybe")), "admin"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsLongSearchDuplicateReorderAndUnknownDefinitions() {
        assertThatThrownBy(() -> service().definitions("x".repeat(101), PageRequest.of(0, 10)))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.SEARCH_TOO_LONG);
        assertThatThrownBy(
                        () ->
                                service()
                                        .reorder(
                                                new UserProfileAttributeOrderRequestDTO(
                                                        List.of(1L, 1L))))
                .isInstanceOf(ApiException.class);
        when(definitionRepository.findAllById(List.of(1L, 2L)))
                .thenReturn(List.of(definition("one", false)));
        assertThatThrownBy(
                        () ->
                                service()
                                        .reorder(
                                                new UserProfileAttributeOrderRequestDTO(
                                                        List.of(1L, 2L))))
                .isInstanceOf(ApiException.class)
                .hasMessage("Profile attribute not found");

        final UserEntity user = user();
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().attributes("missing"))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of());
        when(definitionRepository.findAllByOrderByDisplayOrderAscNameAsc()).thenReturn(List.of());
        when(attributeRepository
                        .findAllByUserIdOrderByDefinitionDisplayOrderAscDefinitionNameAscPositionAsc(
                                7L))
                .thenReturn(List.of());
        assertThat(service().attributes(7L).attributes()).isEmpty();
    }

    @Test
    void savesMappedUsersAndMergesMappedAttributes() {
        UserEntity user = user();
        service().saveMappedUser(user, true);
        verify(userRepository).save(user);
        service().saveMappedUser(user, false);
        verify(userAccessInvalidationService).invalidate("alice");

        service().mergeMappedAttributes(user, Map.of(), "provider");
        UserProfileAttributeDefinitionEntity definition = definition("department", false);
        definition.setId(12L);
        definition.setMultivalued(false);
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(definition));
        service()
                .mergeMappedAttributes(
                        user,
                        Map.of("department", Arrays.asList(" Finance ", null, "HR")),
                        "provider");
        verify(attributeRepository).deleteAllByUserIdAndDefinitionId(7L, 12L);
        verify(attributeRepository).saveAll(any());
        verify(auditEventService).record("social.mapper.profile.updated", "user", "7");
    }

    @Test
    void validatesEmailBooleanLengthPatternAndMultiplicity() {
        UserEntity user = user();
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        UserProfileAttributeDefinitionEntity email = definition("emailAddress", false);
        email.setType(UserProfileAttributeType.EMAIL);
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(email));
        assertThatThrownBy(
                        () ->
                                service()
                                        .saveAttributes(
                                                7L,
                                                Map.of("emailAddress", List.of("invalid")),
                                                "admin"))
                .isInstanceOf(ApiException.class);

        UserProfileAttributeDefinitionEntity booleanValue = definition("enabledFlag", false);
        booleanValue.setType(UserProfileAttributeType.BOOLEAN);
        booleanValue.setMinLength(2);
        booleanValue.setMaxLength(3);
        booleanValue.setPattern("yes");
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(booleanValue));
        assertThatThrownBy(
                        () ->
                                service()
                                        .saveAttributes(
                                                7L, Map.of("enabledFlag", List.of("x")), "admin"))
                .isInstanceOf(ApiException.class);

        UserProfileAttributeDefinitionEntity single = definition("single", false);
        single.setMultivalued(false);
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(single));
        assertThatThrownBy(
                        () ->
                                service()
                                        .saveAttributes(
                                                7L,
                                                Map.of("single", List.of("one", "two")),
                                                "admin"))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(
                        () ->
                                service()
                                        .saveAttributes(
                                                7L, Map.of("unknown", List.of("value")), "admin"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsMissingDefinitionsAndUsers() {
        when(definitionRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(
                        () ->
                                service()
                                        .update(
                                                99L,
                                                request(
                                                        "department",
                                                        UserProfileAttributeType.STRING)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Profile attribute not found");
        assertThatThrownBy(() -> service().delete(99L))
                .isInstanceOf(ApiException.class)
                .hasMessage("Profile attribute not found");

        when(userRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().attributes(99L))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");
    }

    @Test
    void listsEnabledAndAllDefinitionsAndRejectsOversizedSearch() {
        UserProfileAttributeDefinitionEntity enabled = definition("enabled", false);
        UserProfileAttributeDefinitionEntity disabled = definition("disabled", false);
        disabled.setEnabled(false);
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(enabled));
        when(definitionRepository.findAllByOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(disabled, enabled));

        assertThat(service().definitions(true)).extracting("name").containsExactly("enabled");
        assertThat(service().definitions(false))
                .extracting("name")
                .containsExactly("disabled", "enabled");
        assertThatThrownBy(() -> service().definitions("x".repeat(101), PageRequest.of(0, 10)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Search query must not exceed 100 characters");
    }

    @Test
    void savesAttributesByUsernameAndHandlesMissingActionUser() {
        UserEntity user = user();
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user));
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of());
        when(definitionRepository.findAllByOrderByDisplayOrderAscNameAsc()).thenReturn(List.of());
        when(attributeRepository
                        .findAllByUserIdOrderByDefinitionDisplayOrderAscDefinitionNameAscPositionAsc(
                                7L))
                .thenReturn(List.of());

        assertThat(service().saveAttributes("alice", null, "admin").attributes()).isEmpty();
        verify(userAccessInvalidationService).invalidate("alice");

        when(userRepository.findIdByUsername("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().saveAttributes("missing", Map.of(), "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");
        when(userRepository.findIdByUsername("gone")).thenReturn(Optional.of(8L));
        when(userRepository.findForActionById(8L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().saveAttributes("gone", Map.of(), "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");
    }

    @Test
    void doesNotInvalidateAccessWhenUserUpdatesOwnAttributes() {
        UserEntity user = user();
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user));
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of());
        when(definitionRepository.findAllByOrderByDisplayOrderAscNameAsc()).thenReturn(List.of());
        when(attributeRepository
                        .findAllByUserIdOrderByDefinitionDisplayOrderAscDefinitionNameAscPositionAsc(
                                7L))
                .thenReturn(List.of());

        service().saveAttributes("alice", Map.of(), "alice");

        verifyNoInteractions(userAccessInvalidationService);
    }

    @Test
    void mergesNullUnknownAndMultivaluedMappedAttributes() {
        UserEntity user = user();
        service().mergeMappedAttributes(user, null, "provider");
        service().mergeMappedAttributes(user, Map.of("unknown", List.of("value")), "provider");

        UserProfileAttributeDefinitionEntity definition = definition("department", false);
        definition.setId(12L);
        definition.setMultivalued(true);
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(definition));
        service()
                .mergeMappedAttributes(
                        user, Map.of("department", List.of(" Finance ", "HR ")), "provider");
        verify(attributeRepository).deleteAllByUserIdAndDefinitionId(7L, 12L);
        ArgumentCaptor<List> savedValues = ArgumentCaptor.forClass(List.class);
        verify(attributeRepository).saveAll(savedValues.capture());
        assertThat(savedValues.getValue()).hasSize(2);
    }

    @Test
    void permitsBuiltInProfileFieldsAndSkipsBuiltInDefinitionsWhenSaving() {
        UserEntity user = user();
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        UserProfileAttributeDefinitionEntity builtIn = definition("email", false);
        UserProfileAttributeDefinitionEntity custom = definition("department", false);
        custom.setId(4L);
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(builtIn, custom));
        when(definitionRepository.findAllByOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(builtIn, custom));
        when(attributeRepository
                        .findAllByUserIdOrderByDefinitionDisplayOrderAscDefinitionNameAscPositionAsc(
                                7L))
                .thenReturn(List.of());

        service().saveAttributes(7L, Map.of("email", List.of("ignored")), "admin");

        ArgumentCaptor<List> savedValues = ArgumentCaptor.forClass(List.class);
        verify(attributeRepository).saveAll(savedValues.capture());
        assertThat(savedValues.getValue()).isEmpty();
    }

    @Test
    void acceptsValidStringEmailIntegerAndBooleanValuesAndSkipsUnknownRows() {
        UserEntity user = user();
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        UserProfileAttributeDefinitionEntity text = definition("text", false);
        text.setId(1L);
        text.setMinLength(2);
        text.setMaxLength(10);
        text.setPattern("[a-z]+");
        UserProfileAttributeDefinitionEntity email = definition("emailValue", false);
        email.setId(2L);
        email.setType(UserProfileAttributeType.EMAIL);
        UserProfileAttributeDefinitionEntity integer = definition("integerValue", false);
        integer.setId(3L);
        integer.setType(UserProfileAttributeType.INTEGER);
        UserProfileAttributeDefinitionEntity bool = definition("booleanValue", false);
        bool.setId(4L);
        bool.setType(UserProfileAttributeType.BOOLEAN);
        List<UserProfileAttributeDefinitionEntity> definitions =
                List.of(text, email, integer, bool);
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(definitions);
        when(definitionRepository.findAllByOrderByDisplayOrderAscNameAsc()).thenReturn(definitions);
        when(attributeRepository
                        .findAllByUserIdOrderByDefinitionDisplayOrderAscDefinitionNameAscPositionAsc(
                                7L))
                .thenReturn(
                        List.of(
                                new io.github.susimsek.springauthserversamples.domain
                                        .UserProfileAttributeEntity(user, text, 0, "valid"),
                                new io.github.susimsek.springauthserversamples.domain
                                        .UserProfileAttributeEntity(
                                        user, unknownDefinition(), 0, "ignored")));

        service()
                .saveAttributes(
                        7L,
                        Map.of(
                                "text", List.of("valid"),
                                "emailValue", List.of("user@example.com"),
                                "integerValue", List.of("42"),
                                "booleanValue", List.of("true")),
                        "admin");
        assertThat(service().attributes("alice").attributes())
                .containsEntry("text", List.of("valid"))
                .doesNotContainKey("ignored");
    }

    @Test
    void coversBuiltInMapperRowsNullSubmittedValuesAndBuiltInRequestKeys() {
        final UserEntity user = user();
        UserProfileAttributeDefinitionEntity builtIn = definition("email", false);
        builtIn.setId(1L);
        UserProfileAttributeDefinitionEntity tags = definition("tags", false);
        tags.setId(2L);
        tags.setMultivalued(true);

        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(builtIn, tags));
        java.util.Map<String, List<String>> mapped = new java.util.LinkedHashMap<>();
        mapped.put("tags", List.of("one"));
        service().mergeMappedAttributes(user, mapped, "provider");

        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc())
                .thenReturn(List.of(tags));
        assertThatThrownBy(
                        () ->
                                service()
                                        .saveAttributes(
                                                7L, Map.of("email", List.of("ignored")), "admin"))
                .isInstanceOf(ApiException.class);

        java.util.Map<String, List<String>> nullValues = new java.util.LinkedHashMap<>();
        nullValues.put("tags", null);
        service().saveAttributes(7L, nullValues, "admin");
    }

    private UserProfileService service() {
        return new UserProfileService(
                definitionRepository,
                attributeRepository,
                userRepository,
                auditEventService,
                userAccessInvalidationService,
                entityManager);
    }

    private static UserProfileAttributeDefinitionRequestDTO request(
            String name, UserProfileAttributeType type) {
        return new UserProfileAttributeDefinitionRequestDTO(
                name, "Display", null, type, false, false, null, null, null, true, 0);
    }

    private static UserProfileAttributeDefinitionRequestDTO requestWithPattern(
            String name, String pattern) {
        return new UserProfileAttributeDefinitionRequestDTO(
                name,
                "Display",
                null,
                UserProfileAttributeType.STRING,
                false,
                false,
                null,
                null,
                pattern,
                true,
                0);
    }

    private static UserProfileAttributeDefinitionEntity definition(String name, boolean required) {
        UserProfileAttributeDefinitionEntity definition =
                new UserProfileAttributeDefinitionEntity();
        definition.setId(3L);
        definition.setName(name);
        definition.setDisplayName(name);
        definition.setType(UserProfileAttributeType.STRING);
        definition.setRequired(required);
        definition.setEnabled(true);
        return definition;
    }

    private static UserProfileAttributeDefinitionEntity unknownDefinition() {
        UserProfileAttributeDefinitionEntity definition = definition("unknown", false);
        definition.setId(99L);
        return definition;
    }

    private static UserEntity user() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        return user;
    }
}
