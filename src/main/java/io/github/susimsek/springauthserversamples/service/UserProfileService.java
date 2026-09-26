package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.domain.UserProfileAttributeDefinitionEntity;
import io.github.susimsek.springauthserversamples.domain.UserProfileAttributeEntity;
import io.github.susimsek.springauthserversamples.dto.userprofile.UserProfileAttributeDefinitionDTO;
import io.github.susimsek.springauthserversamples.dto.userprofile.UserProfileAttributeDefinitionRequestDTO;
import io.github.susimsek.springauthserversamples.dto.userprofile.UserProfileAttributeOrderRequestDTO;
import io.github.susimsek.springauthserversamples.dto.userprofile.UserProfileAttributesDTO;
import io.github.susimsek.springauthserversamples.repository.UserProfileAttributeDefinitionRepository;
import io.github.susimsek.springauthserversamples.repository.UserProfileAttributeRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.admin.UserAccessInvalidationService;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import jakarta.persistence.EntityManager;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@SuppressWarnings("java:S6916")
public class UserProfileService {

    private static final String USER_PROFILE_ATTRIBUTE = "user-profile-attribute";
    private static final String USER_NOT_FOUND = "User not found";
    private static final String ATTRIBUTES_FIELD_PREFIX = "attributes.";

    private static final Set<String> BUILT_IN_NAMES =
            Set.of("username", "firstName", "lastName", "email", "emailVerified");
    private static final Set<String> PROFILE_BUILT_IN_NAMES =
            Set.of("username", "firstName", "lastName", "email");

    private final UserProfileAttributeDefinitionRepository definitionRepository;
    private final UserProfileAttributeRepository attributeRepository;
    private final UserRepository userRepository;
    private final AdminAuditEventService auditEventService;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public List<UserProfileAttributeDefinitionDTO> definitions(boolean enabledOnly) {
        List<UserProfileAttributeDefinitionEntity> definitions =
                enabledOnly
                        ? definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc()
                        : definitionRepository.findAllByOrderByDisplayOrderAscNameAsc();
        return definitions.stream().map(this::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public Page<UserProfileAttributeDefinitionDTO> definitions(String query, Pageable pageable) {
        String normalizedQuery = normalizeSearch(query);
        return definitionRepository
                .findByNameContainingIgnoreCaseOrDisplayNameContainingIgnoreCase(
                        normalizedQuery, normalizedQuery, pageable)
                .map(this::toDTO);
    }

    private String normalizeSearch(String query) {
        String normalized = query == null ? "" : query.strip();
        if (normalized.length() > 100) {
            throw ApiException.badRequest(
                    "q",
                    ApiErrorCode.SEARCH_TOO_LONG,
                    "Search query must not exceed 100 characters");
        }
        return normalized;
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                UserProfileAttributeDefinitionRepository.ALL_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE,
                UserProfileAttributeDefinitionRepository
                        .ENABLED_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE,
                UserProfileAttributeDefinitionRepository.PROFILE_ATTRIBUTE_DEFINITION_BY_NAME_CACHE
            },
            allEntries = true)
    public UserProfileAttributeDefinitionDTO create(
            UserProfileAttributeDefinitionRequestDTO request) {
        validateDefinition(request, null);
        UserProfileAttributeDefinitionEntity definition =
                new UserProfileAttributeDefinitionEntity();
        apply(request, definition);
        UserProfileAttributeDefinitionEntity saved = definitionRepository.save(definition);
        auditEventService.record(
                "user-profile.attribute.created", USER_PROFILE_ATTRIBUTE, saved.getId().toString());
        return toDTO(saved);
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                UserProfileAttributeDefinitionRepository.ALL_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE,
                UserProfileAttributeDefinitionRepository
                        .ENABLED_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE,
                UserProfileAttributeDefinitionRepository.PROFILE_ATTRIBUTE_DEFINITION_BY_NAME_CACHE
            },
            allEntries = true)
    public UserProfileAttributeDefinitionDTO update(
            Long id, UserProfileAttributeDefinitionRequestDTO request) {
        UserProfileAttributeDefinitionEntity definition = findDefinition(id);
        validateDefinition(request, id);
        if (isBuiltIn(definition) && !definition.getName().equals(request.name().trim())) {
            throw ApiException.badRequest(
                    "name", ApiErrorCode.USER_PROFILE_INVALID_NAME, "Built-in names cannot change");
        }
        apply(request, definition);
        definitionRepository.save(definition);
        auditEventService.record(
                "user-profile.attribute.updated", USER_PROFILE_ATTRIBUTE, id.toString());
        return toDTO(definition);
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                UserProfileAttributeDefinitionRepository.ALL_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE,
                UserProfileAttributeDefinitionRepository
                        .ENABLED_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE,
                UserProfileAttributeDefinitionRepository.PROFILE_ATTRIBUTE_DEFINITION_BY_NAME_CACHE
            },
            allEntries = true)
    public List<UserProfileAttributeDefinitionDTO> reorder(
            UserProfileAttributeOrderRequestDTO request) {
        List<Long> ids = request.ids();
        if (ids.size() != new HashSet<>(ids).size()) {
            throw ApiException.badRequest(
                    "ids",
                    ApiErrorCode.USER_PROFILE_INVALID_DEFINITION,
                    "Profile attribute identifiers must be unique");
        }
        List<UserProfileAttributeDefinitionEntity> definitions =
                definitionRepository.findAllById(ids);
        if (definitions.size() != ids.size()) {
            throw ApiException.notFound("Profile attribute not found");
        }
        Map<Long, UserProfileAttributeDefinitionEntity> byId =
                definitions.stream()
                        .collect(
                                Collectors.toMap(
                                        UserProfileAttributeDefinitionEntity::getId,
                                        definition -> definition));
        int displayOrder =
                definitions.stream()
                        .mapToInt(UserProfileAttributeDefinitionEntity::getDisplayOrder)
                        .min()
                        .orElse(0);
        for (Long id : ids) {
            byId.get(id).setDisplayOrder(displayOrder++);
        }
        definitionRepository.saveAll(definitions);
        auditEventService.record(
                "user-profile.attributes.reordered", "user-profile-attributes", "order");
        return definitionRepository.findAllByOrderByDisplayOrderAscNameAsc().stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                UserProfileAttributeDefinitionRepository.ALL_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE,
                UserProfileAttributeDefinitionRepository
                        .ENABLED_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE,
                UserProfileAttributeDefinitionRepository.PROFILE_ATTRIBUTE_DEFINITION_BY_NAME_CACHE
            },
            allEntries = true)
    public void delete(Long id) {
        UserProfileAttributeDefinitionEntity definition = findDefinition(id);
        if (isBuiltIn(definition)) {
            throw ApiException.badRequest(
                    "id",
                    ApiErrorCode.USER_PROFILE_INVALID_NAME,
                    "Built-in attributes cannot be deleted");
        }
        if (attributeRepository.existsByDefinitionId(id)) {
            attributeRepository.deleteAllByDefinitionId(id);
        }
        definitionRepository.delete(definition);
        auditEventService.record(
                "user-profile.attribute.deleted", USER_PROFILE_ATTRIBUTE, id.toString());
    }

    @Transactional(readOnly = true)
    public UserProfileAttributesDTO attributes(Long userId) {
        UserEntity user = findUser(userId);
        return toAttributes(user);
    }

    @Transactional(readOnly = true)
    public UserProfileAttributesDTO attributes(String username) {
        UserEntity user =
                userRepository
                        .findByUsername(username)
                        .orElseThrow(() -> ApiException.notFound(USER_NOT_FOUND));
        return toAttributes(user);
    }

    @Transactional
    public UserProfileAttributesDTO saveAttributes(
            Long userId, Map<String, List<String>> values, String actor) {
        UserEntity user = findUser(userId);
        return saveUserAttributes(user, values, actor);
    }

    @Transactional
    public UserProfileAttributesDTO saveAttributes(
            String username, Map<String, List<String>> values, String actor) {
        UserEntity user =
                userRepository
                        .findForActionById(
                                userRepository
                                        .findIdByUsername(username)
                                        .orElseThrow(() -> ApiException.notFound(USER_NOT_FOUND)))
                        .orElseThrow(() -> ApiException.notFound(USER_NOT_FOUND));
        return saveUserAttributes(user, values, actor);
    }

    /** Persists mapper-owned built-in fields without replacing the stable username. */
    @Transactional
    public void saveMappedUser(UserEntity user, boolean firstLogin) {
        userRepository.save(user);
        if (!firstLogin) {
            userAccessInvalidationService.invalidate(user.getUsername());
            auditEventService.record("social.mapper.user.updated", "user", user.getId().toString());
        }
    }

    /** Merges only the profile attributes supplied by an identity-provider mapper. */
    @Transactional
    public void mergeMappedAttributes(
            UserEntity user, Map<String, List<String>> mappedValues, String actor) {
        if (mappedValues == null || mappedValues.isEmpty()) {
            return;
        }
        Map<String, UserProfileAttributeDefinitionEntity> definitions =
                definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc().stream()
                        .filter(definition -> !isBuiltIn(definition))
                        .collect(
                                Collectors.toMap(
                                        UserProfileAttributeDefinitionEntity::getName, d -> d));
        List<UserProfileAttributeEntity> rows = new ArrayList<>();
        boolean changed = false;
        for (Map.Entry<String, List<String>> entry : mappedValues.entrySet()) {
            UserProfileAttributeDefinitionEntity definition = definitions.get(entry.getKey());
            if (definition == null) {
                continue;
            }
            List<String> values =
                    entry.getValue() == null
                            ? List.of()
                            : entry.getValue().stream()
                                    .filter(Objects::nonNull)
                                    .map(String::trim)
                                    .filter(value -> !value.isEmpty())
                                    .toList();
            if (!definition.isMultivalued() && values.size() > 1) {
                values = values.subList(0, 1);
            }
            values.forEach(value -> validateValue(definition, value));
            attributeRepository.deleteAllByUserIdAndDefinitionId(user.getId(), definition.getId());
            for (int index = 0; index < values.size(); index++) {
                rows.add(
                        new UserProfileAttributeEntity(user, definition, index, values.get(index)));
            }
            changed = true;
        }
        if (changed) {
            entityManager.flush();
            attributeRepository.saveAll(rows);
            userAccessInvalidationService.invalidate(user.getUsername());
            auditEventService.record(
                    "social.mapper.profile.updated", "user", user.getId().toString());
        }
    }

    private UserProfileAttributesDTO saveUserAttributes(
            UserEntity user, Map<String, List<String>> values, String actor) {
        Map<String, List<String>> normalized = validateValues(values == null ? Map.of() : values);
        attributeRepository.deleteAllByUserId(user.getId());
        entityManager.flush();
        List<UserProfileAttributeDefinitionEntity> definitions =
                definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc().stream()
                        .filter(definition -> !isBuiltIn(definition))
                        .toList();
        List<UserProfileAttributeEntity> rows = new ArrayList<>();
        for (UserProfileAttributeDefinitionEntity definition : definitions) {
            List<String> definitionValues =
                    normalized.getOrDefault(definition.getName(), List.of());
            for (int index = 0; index < definitionValues.size(); index++) {
                rows.add(
                        new UserProfileAttributeEntity(
                                user, definition, index, definitionValues.get(index)));
            }
        }
        attributeRepository.saveAll(rows);
        if (!user.getUsername().equals(actor)) {
            userAccessInvalidationService.invalidate(user.getUsername());
        }
        auditEventService.record(
                "user-profile.attributes.updated", "user", user.getId().toString());
        return toAttributes(user);
    }

    private UserProfileAttributesDTO toAttributes(UserEntity user) {
        List<UserProfileAttributeDefinitionEntity> definitions =
                definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc();
        Map<Long, String> names =
                definitionRepository.findAllByOrderByDisplayOrderAscNameAsc().stream()
                        .collect(
                                Collectors.toMap(
                                        UserProfileAttributeDefinitionEntity::getId,
                                        UserProfileAttributeDefinitionEntity::getName));
        Map<String, List<String>> values = new LinkedHashMap<>();
        attributeRepository
                .findAllByUserIdOrderByDefinitionDisplayOrderAscDefinitionNameAscPositionAsc(
                        user.getId())
                .forEach(
                        attribute -> {
                            String name = names.get(attribute.getDefinition().getId());
                            if (name != null) {
                                values.computeIfAbsent(name, key -> new ArrayList<>())
                                        .add(attribute.getValue());
                            }
                        });
        return new UserProfileAttributesDTO(definitions.stream().map(this::toDTO).toList(), values);
    }

    private Map<String, List<String>> validateValues(Map<String, List<String>> values) {
        List<UserProfileAttributeDefinitionEntity> definitions =
                definitionRepository.findAllByEnabledTrueOrderByDisplayOrderAscNameAsc();
        Set<String> names =
                definitions.stream()
                        .map(UserProfileAttributeDefinitionEntity::getName)
                        .collect(Collectors.toSet());
        if (!names.containsAll(values.keySet())) {
            String unknown =
                    values.keySet().stream()
                            .filter(
                                    name ->
                                            !names.contains(name)
                                                    && !PROFILE_BUILT_IN_NAMES.contains(name))
                            .findFirst()
                            .orElse("attributes");
            throw ApiException.badRequest(
                    ATTRIBUTES_FIELD_PREFIX + unknown,
                    ApiErrorCode.USER_PROFILE_INVALID_VALUE,
                    "The profile attribute is not configured");
        }
        Map<String, List<String>> normalized = new LinkedHashMap<>();
        for (UserProfileAttributeDefinitionEntity definition : definitions) {
            if (isBuiltIn(definition)) {
                continue;
            }
            List<String> submitted = values.getOrDefault(definition.getName(), List.of());
            List<String> definitionValues =
                    submitted == null
                            ? List.of()
                            : submitted.stream()
                                    .filter(Objects::nonNull)
                                    .map(String::trim)
                                    .filter(value -> !value.isEmpty())
                                    .toList();
            if (!definition.isMultivalued() && definitionValues.size() > 1) {
                throw invalidValue(definition, "Only one value is allowed");
            }
            if (definition.isRequired() && definitionValues.isEmpty()) {
                throw ApiException.badRequest(
                        ATTRIBUTES_FIELD_PREFIX + definition.getName(),
                        ApiErrorCode.USER_PROFILE_REQUIRED,
                        "The profile attribute is required");
            }
            definitionValues.forEach(value -> validateValue(definition, value));
            normalized.put(definition.getName(), definitionValues);
        }
        return normalized;
    }

    private void validateValue(UserProfileAttributeDefinitionEntity definition, String value) {
        if (definition.getMinLength() != null && value.length() < definition.getMinLength()) {
            throw invalidValue(definition, "The value is shorter than the configured minimum");
        }
        if (definition.getMaxLength() != null && value.length() > definition.getMaxLength()) {
            throw invalidValue(definition, "The value is longer than the configured maximum");
        }
        if (definition.getPattern() != null
                && !definition.getPattern().isBlank()
                && !Pattern.matches(definition.getPattern(), value)) {
            throw invalidValue(definition, "The value does not match the configured pattern");
        }
        try {
            switch (definition.getType()) {
                case EMAIL -> {
                    if (!value.contains("@") || value.startsWith("@") || value.endsWith("@")) {
                        throw invalidValue(definition, "The value must be an email address");
                    }
                }
                case INTEGER -> Integer.parseInt(value);
                case BOOLEAN -> {
                    if (!value.equalsIgnoreCase("true") && !value.equalsIgnoreCase("false")) {
                        throw invalidValue(definition, "The value must be true or false");
                    }
                }
                case STRING -> { // String values require no additional validation.
                }
                default -> throw invalidValue(definition, "The value type is not supported");
            }
        } catch (NumberFormatException _) {
            throw invalidValue(definition, "The value must be an integer");
        }
    }

    private ApiException invalidValue(
            UserProfileAttributeDefinitionEntity definition, String message) {
        return ApiException.badRequest(
                ATTRIBUTES_FIELD_PREFIX + definition.getName(),
                ApiErrorCode.USER_PROFILE_INVALID_VALUE,
                message);
    }

    private void validateDefinition(
            UserProfileAttributeDefinitionRequestDTO request, Long currentId) {
        String name = request.name() == null ? "" : request.name().trim();
        if (BUILT_IN_NAMES.contains(name)) {
            throw ApiException.badRequest(
                    "name", ApiErrorCode.USER_PROFILE_INVALID_NAME, "This name is reserved");
        }
        definitionRepository
                .findByNameIgnoreCase(name)
                .filter(definition -> !definition.getId().equals(currentId))
                .ifPresent(
                        definition -> {
                            throw ApiException.conflict(
                                    "name",
                                    ApiErrorCode.USER_PROFILE_DUPLICATE_NAME,
                                    "The profile attribute already exists");
                        });
        if (request.minLength() != null
                && request.maxLength() != null
                && request.minLength() > request.maxLength()) {
            throw ApiException.badRequest(
                    "maxLength",
                    ApiErrorCode.USER_PROFILE_INVALID_DEFINITION,
                    "Maximum length must be greater than or equal to minimum length");
        }
        if (request.pattern() != null && !request.pattern().isBlank()) {
            try {
                Pattern.compile(request.pattern());
            } catch (PatternSyntaxException _) {
                throw ApiException.badRequest(
                        "pattern",
                        ApiErrorCode.USER_PROFILE_INVALID_DEFINITION,
                        "The pattern is invalid");
            }
        }
    }

    private void apply(
            UserProfileAttributeDefinitionRequestDTO request,
            UserProfileAttributeDefinitionEntity definition) {
        definition.setName(request.name().trim());
        definition.setDisplayName(request.displayName().trim());
        definition.setDescription(blankToNull(request.description()));
        definition.setType(request.type());
        definition.setRequired(request.required());
        definition.setMultivalued(request.multivalued());
        definition.setMinLength(request.minLength());
        definition.setMaxLength(request.maxLength());
        definition.setPattern(blankToNull(request.pattern()));
        definition.setEnabled(request.enabled());
        definition.setDisplayOrder(request.displayOrder());
    }

    private UserProfileAttributeDefinitionDTO toDTO(
            UserProfileAttributeDefinitionEntity definition) {
        return new UserProfileAttributeDefinitionDTO(
                definition.getId(),
                definition.getName(),
                definition.getDisplayName(),
                definition.getDescription(),
                definition.getType(),
                definition.isRequired(),
                definition.isMultivalued(),
                definition.getMinLength(),
                definition.getMaxLength(),
                definition.getPattern(),
                definition.isEnabled(),
                definition.getDisplayOrder(),
                isBuiltIn(definition));
    }

    private boolean isBuiltIn(UserProfileAttributeDefinitionEntity definition) {
        return PROFILE_BUILT_IN_NAMES.contains(definition.getName());
    }

    private UserProfileAttributeDefinitionEntity findDefinition(Long id) {
        return definitionRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Profile attribute not found"));
    }

    private UserEntity findUser(Long id) {
        return userRepository.findById(id).orElseThrow(() -> ApiException.notFound(USER_NOT_FOUND));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
