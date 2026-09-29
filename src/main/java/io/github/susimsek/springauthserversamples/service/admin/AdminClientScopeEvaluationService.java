package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.domain.ClientMapperEntity;
import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import io.github.susimsek.springauthserversamples.domain.ClientScopeMapperEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientScopeEvaluationDTO;
import io.github.susimsek.springauthserversamples.repository.ClientMapperRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.ClientScopeMapperRepository;
import io.github.susimsek.springauthserversamples.repository.ClientScopeRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import io.github.susimsek.springauthserversamples.service.security.EffectiveRoleService;
import java.util.Arrays;
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

    @Transactional(readOnly = true)
    public AdminClientScopeEvaluationDTO evaluate(String clientId, String scopes, String subject) {
        var client =
                clientRepository
                        .findById(clientId)
                        .orElseThrow(() -> ApiException.notFound("Client not found"));
        Set<String> requested = parse(scopes);
        Set<String> allowed = parse(client.getScopes());
        Set<String> effective =
                requested.isEmpty()
                        ? allowed
                        : requested.stream()
                                .filter(allowed::contains)
                                .collect(Collectors.toCollection(LinkedHashSet::new));
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
        for (ClientMapperEntity mapper : clientMappers) {
            if ("hardcoded-claim".equals(mapper.getMapperType())
                    || "audience".equals(mapper.getMapperType())) {
                claims.put(mapper.getClaimName(), mapper.getValue());
            }
        }
        for (ClientScopeMapperEntity mapper : scopeMappers) {
            if ("hardcoded-claim".equals(mapper.getMapperType())
                    || "audience".equals(mapper.getMapperType())) {
                claims.put(mapper.getClaimName(), mapper.getValue());
            }
        }
        Set<String> roles = new LinkedHashSet<>();
        if (StringUtils.hasText(subject)) {
            userRepository
                    .findByUsername(subject)
                    .ifPresent(
                            user ->
                                    roles.addAll(
                                            scopedClientRoles(
                                                            EffectiveRoleService
                                                                    .effectiveClientRoleNames(user),
                                                            clientScopes)
                                                    .getOrDefault(client.getClientId(), Set.of())));
        }
        List<String> mappedClaims =
                java.util.stream.Stream.concat(
                                clientMappers.stream().map(ClientMapperEntity::getClaimName),
                                scopeMappers.stream().map(ClientScopeMapperEntity::getClaimName))
                        .distinct()
                        .toList();
        return new AdminClientScopeEvaluationDTO(requested, effective, mappedClaims, roles, claims);
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
