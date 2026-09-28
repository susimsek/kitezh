package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.domain.ClientMapperEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientScopeEvaluationDTO;
import io.github.susimsek.springauthserversamples.repository.ClientMapperRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import io.github.susimsek.springauthserversamples.service.security.EffectiveRoleService;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
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
        var mappers = mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc(clientId);
        Map<String, Object> claims = new LinkedHashMap<>();
        for (ClientMapperEntity mapper : mappers) {
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
                                            EffectiveRoleService.effectiveClientRoleNames(user)
                                                    .getOrDefault(client.getClientId(), Set.of())));
        }
        return new AdminClientScopeEvaluationDTO(
                requested,
                effective,
                mappers.stream().map(ClientMapperEntity::getClaimName).distinct().toList(),
                roles,
                claims);
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
