package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.ClientMapperEntity;
import io.github.susimsek.kitezh.domain.ClientScopeEntity;
import io.github.susimsek.kitezh.domain.ClientScopeMapperEntity;
import io.github.susimsek.kitezh.domain.GroupEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminClientScopeEvaluationDTO;
import io.github.susimsek.kitezh.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.kitezh.mapper.RegisteredClientMapper;
import io.github.susimsek.kitezh.repository.ClientMapperRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.repository.ClientScopeMapperRepository;
import io.github.susimsek.kitezh.repository.ClientScopeRepository;
import io.github.susimsek.kitezh.repository.UserProfileAttributeRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.ProtocolMapperTypes;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.EffectiveRoleService;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class AdminClientScopeEvaluationService {

    private final ClientRepository clientRepository;
    private final ClientMapperRepository mapperRepository;
    private final ClientScopeRepository clientScopeRepository;
    private final ClientScopeMapperRepository clientScopeMapperRepository;
    private final UserRepository userRepository;
    private final UserProfileAttributeRepository userProfileAttributeRepository;
    private final RegisteredClientMapper registeredClientMapper;
    private final AuthorizationServerMapperSupport mapperSupport;

    @Transactional(readOnly = true)
    public AdminClientScopeEvaluationDTO evaluate(String clientId, String scopes, String subject) {
        var client =
                clientRepository
                        .findById(clientId)
                        .orElseThrow(() -> ApiException.notFound("Client not found"));
        Set<String> requested = parse(scopes);
        Set<String> allowed = parse(client.getScopes());
        Set<String> effective = new LinkedHashSet<>();
        requested.stream().filter(allowed::contains).forEach(effective::add);
        defaultScopes(client).stream().filter(allowed::contains).forEach(effective::add);
        var clientMappers = mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc(clientId);
        List<ClientScopeEntity> clientScopes =
                effective.isEmpty() ? List.of() : clientScopeRepository.findByNameIn(effective);
        List<ClientScopeMapperEntity> scopeMappers =
                clientScopes.isEmpty()
                        ? List.of()
                        : clientScopeMapperRepository
                                .findAllByClientScopeIdInOrderByPriorityAscNameAsc(
                                        clientScopes.stream()
                                                .map(ClientScopeEntity::getId)
                                                .toList());
        Map<String, Object> claims = new LinkedHashMap<>();
        UserEntity evaluationUser = findUser(subject);
        for (ClientMapperEntity mapper : clientMappers) {
            addMapperClaim(claims, mapper, evaluationUser, client, clientScopes);
        }
        for (ClientScopeMapperEntity mapper : scopeMappers) {
            addMapperClaim(claims, mapper, evaluationUser, client, clientScopes);
        }
        Set<String> roles = new LinkedHashSet<>();
        if (evaluationUser != null) {
            roles.addAll(
                    scopedClientRoles(
                                    EffectiveRoleService.effectiveClientRoleNames(evaluationUser),
                                    clientScopes)
                            .getOrDefault(client.getClientId(), Set.of()));
        }
        List<String> mappedClaims =
                java.util.stream.Stream.concat(
                                clientMappers.stream().map(ClientMapperEntity::getClaimName),
                                scopeMappers.stream().map(ClientScopeMapperEntity::getClaimName))
                        .distinct()
                        .toList();
        return new AdminClientScopeEvaluationDTO(requested, effective, mappedClaims, roles, claims);
    }

    private Set<String> defaultScopes(
            io.github.susimsek.kitezh.domain.RegisteredClientEntity client) {
        if (registeredClientMapper == null || mapperSupport == null) {
            return Set.of();
        }
        return ClientScopeSettings.defaultScopes(
                registeredClientMapper.toObject(client, mapperSupport));
    }

    private UserEntity findUser(String subject) {
        return StringUtils.hasText(subject)
                ? userRepository.findByUsername(subject).orElse(null)
                : null;
    }

    private void addMapperClaim(
            Map<String, Object> claims,
            ClientMapperEntity mapper,
            UserEntity user,
            io.github.susimsek.kitezh.domain.RegisteredClientEntity client,
            List<ClientScopeEntity> scopes) {
        Object value =
                mapperValue(
                        mapper.getMapperType(),
                        mapper.getSource(),
                        mapper.getValue(),
                        user,
                        client,
                        scopes);
        addClaim(claims, mapper.getMapperType(), mapper.getClaimName(), value);
    }

    private void addMapperClaim(
            Map<String, Object> claims,
            ClientScopeMapperEntity mapper,
            UserEntity user,
            io.github.susimsek.kitezh.domain.RegisteredClientEntity client,
            List<ClientScopeEntity> scopes) {
        Object value =
                mapperValue(
                        mapper.getMapperType(),
                        mapper.getSource(),
                        mapper.getValue(),
                        user,
                        client,
                        scopes);
        addClaim(claims, mapper.getMapperType(), mapper.getClaimName(), value);
    }

    private Object mapperValue(
            String mapperType,
            String source,
            String value,
            UserEntity user,
            io.github.susimsek.kitezh.domain.RegisteredClientEntity client,
            List<ClientScopeEntity> scopes) {
        String normalizedType = ProtocolMapperTypes.canonicalize(mapperType);
        if (ProtocolMapperTypes.HARDCODED_CLAIM.equals(normalizedType)) {
            return value;
        }
        if (ProtocolMapperTypes.AUDIENCE.equals(normalizedType)) {
            return StringUtils.hasText(value) ? List.of(value) : null;
        }
        if (ProtocolMapperTypes.AUDIENCE_RESOLVE.equals(normalizedType)) {
            return user == null
                    ? null
                    : EffectiveRoleService.effectiveClientRoleNames(user).keySet().stream()
                            .filter(clientId -> !clientId.equals(client.getClientId()))
                            .filter(clientId -> clientRolesAllowed(clientId, scopes))
                            .sorted()
                            .toList();
        }
        if (user == null) {
            return null;
        }
        return switch (normalizedType) {
            case ProtocolMapperTypes.USER_PROPERTY -> userProperty(user, source);
            case ProtocolMapperTypes.USER_ATTRIBUTE -> userAttribute(user, source);
            case ProtocolMapperTypes.GROUP_MEMBERSHIP -> groupMemberships(user);
            case ProtocolMapperTypes.GROUP_ATTRIBUTE -> groupAttribute(user, source);
            case ProtocolMapperTypes.APPLICATION_ROLE ->
                    new ArrayList<>(EffectiveRoleService.effectiveRoleNames(user));
            case ProtocolMapperTypes.CLIENT_ROLE ->
                    new ArrayList<>(
                            EffectiveRoleService.effectiveClientRoleNames(user)
                                    .getOrDefault(client.getClientId(), Set.of()));
            case ProtocolMapperTypes.EMAIL -> user.getEmail();
            case ProtocolMapperTypes.FULL_NAME -> fullName(user);
            case ProtocolMapperTypes.LOCALE -> user.getPreferredLocale();
            case ProtocolMapperTypes.USERNAME -> user.getUsername();
            default -> null;
        };
    }

    private static boolean clientRolesAllowed(String clientId, List<ClientScopeEntity> scopes) {
        if (scopes.isEmpty()) {
            return true;
        }
        return scopes.stream()
                .flatMap(
                        scope ->
                                EffectiveRoleService.expandScopeRoles(
                                        scope.getApplicationRoles(), scope.getClientRoles())
                                        .clientRoles()
                                        .keySet()
                                        .stream())
                .anyMatch(clientId::equals);
    }

    private void addClaim(
            Map<String, Object> claims, String mapperType, String claimName, Object value) {
        if (value == null) {
            return;
        }
        String normalizedType = ProtocolMapperTypes.canonicalize(mapperType);
        if (ProtocolMapperTypes.AUDIENCE.equals(normalizedType)
                || ProtocolMapperTypes.AUDIENCE_RESOLVE.equals(normalizedType)) {
            Collection<?> values =
                    value instanceof Collection<?> collection ? collection : List.of(value);
            Set<String> audiences = new LinkedHashSet<>();
            Object current = claims.get("aud");
            if (current instanceof String audience) {
                audiences.add(audience);
            } else if (current instanceof Collection<?> currentValues) {
                currentValues.stream()
                        .filter(String.class::isInstance)
                        .map(String.class::cast)
                        .forEach(audiences::add);
            }
            values.stream()
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .forEach(audiences::add);
            if (!audiences.isEmpty()) {
                claims.put("aud", List.copyOf(audiences));
            }
            return;
        }
        if (!StringUtils.hasText(claimName)) {
            return;
        }
        claims.put(claimName, value);
    }

    private Object userProperty(UserEntity user, String source) {
        return switch (source == null ? "" : source) {
            case "username" -> user.getUsername();
            case "firstName" -> user.getFirstName();
            case "lastName" -> user.getLastName();
            case "email" -> user.getEmail();
            case "preferredLocale" -> user.getPreferredLocale();
            default -> null;
        };
    }

    private Object userAttribute(UserEntity user, String source) {
        if (userProfileAttributeRepository == null || !StringUtils.hasText(source)) {
            return null;
        }
        List<String> values =
                userProfileAttributeRepository
                        .findAllByUserIdOrderByDefinitionDisplayOrderAscDefinitionNameAscPositionAsc(
                                user.getId())
                        .stream()
                        .filter(attribute -> source.equals(attribute.getDefinition().getName()))
                        .map(io.github.susimsek.kitezh.domain.UserProfileAttributeEntity::getValue)
                        .toList();
        return singleOrList(values);
    }

    private static List<String> groupMemberships(UserEntity user) {
        return user.getGroups() == null
                ? List.of()
                : user.getGroups().stream()
                        .map(AdminClientScopeEvaluationService::groupPath)
                        .sorted()
                        .toList();
    }

    private static Object groupAttribute(UserEntity user, String source) {
        if (!StringUtils.hasText(source) || user.getGroups() == null) {
            return null;
        }
        List<String> values =
                user.getGroups().stream()
                        .filter(group -> group.getAttributes() != null)
                        .flatMap(group -> group.getAttributes().stream())
                        .filter(attribute -> source.equals(attribute.getName()))
                        .map(io.github.susimsek.kitezh.domain.GroupAttribute::getValue)
                        .distinct()
                        .toList();
        return singleOrList(values);
    }

    private static Object singleOrList(List<String> values) {
        if (values.isEmpty()) {
            return null;
        }
        if (values.size() == 1) {
            return values.getFirst();
        }
        return values;
    }

    private static String fullName(UserEntity user) {
        return java.util.stream.Stream.of(user.getFirstName(), user.getLastName())
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.joining(" "));
    }

    private static String groupPath(GroupEntity group) {
        List<String> names = new ArrayList<>();
        Set<GroupEntity> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        GroupEntity current = group;
        while (current != null && visited.add(current)) {
            names.add(current.getName());
            current = current.getParent();
        }
        Collections.reverse(names);
        return "/" + String.join("/", names);
    }

    private static Map<String, Set<String>> scopedClientRoles(
            Map<String, Set<String>> roles, List<ClientScopeEntity> scopes) {
        Set<String> mappedRoles = new LinkedHashSet<>();
        Map<String, Set<String>> mappedClientRoles = new LinkedHashMap<>();
        for (ClientScopeEntity scope : scopes) {
            var expanded =
                    EffectiveRoleService.expandScopeRoles(
                            scope.getApplicationRoles(), scope.getClientRoles());
            mappedRoles.addAll(expanded.applicationRoles());
            expanded.clientRoles()
                    .forEach(
                            (clientId, names) ->
                                    mappedClientRoles
                                            .computeIfAbsent(
                                                    clientId, ignored -> new LinkedHashSet<>())
                                            .addAll(names));
        }
        if (mappedRoles.isEmpty() && mappedClientRoles.isEmpty()) {
            return roles;
        }
        return roles.entrySet().stream()
                .map(
                        entry ->
                                Map.entry(
                                        entry.getKey(),
                                        entry.getValue().stream()
                                                .filter(
                                                        role ->
                                                                mappedClientRoles
                                                                        .getOrDefault(
                                                                                entry.getKey(),
                                                                                Set.of())
                                                                        .contains(role))
                                                .collect(Collectors.toSet())))
                .filter(entry -> !entry.getValue().isEmpty())
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    private static Set<String> parse(String value) {
        if (!StringUtils.hasText(value)) {
            return new LinkedHashSet<>();
        }
        return Arrays.stream(value.split("[,\\s]+"))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
