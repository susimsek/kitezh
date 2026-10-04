package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.AuthorizationConsentEntity;
import io.github.susimsek.kitezh.domain.AuthorizationConsentId;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminConsentDTO;
import io.github.susimsek.kitezh.mapper.AdminConsentMapper;
import io.github.susimsek.kitezh.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.kitezh.repository.AuthorizationConsentRepository;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminConsentService {

    private final AdminUserService adminUserService;
    private final AuthorizationConsentRepository authorizationConsentRepository;
    private final AuthorizationRepository authorizationRepository;
    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final AuthorizationServerMapperSupport mapperSupport;
    private final AdminAuditEventService adminAuditEventService;
    private final AdminConsentMapper adminConsentMapper;

    @Transactional(readOnly = true)
    public Page<AdminConsentDTO> consents(
            String query, String clientId, String username, String scope, Pageable pageable) {
        String search = AdminSearch.normalize(query);
        String client = AdminSearch.normalize(clientId);
        String principal = AdminSearch.normalize(username);
        String grantedScope = AdminSearch.normalize(scope);
        Page<AuthorizationConsentEntity> consents =
                authorizationConsentRepository.findAll(
                        (root, criteriaQuery, cb) -> {
                            var predicate = cb.conjunction();
                            if (!search.isBlank()) {
                                String like = "%" + search.toLowerCase() + "%";
                                predicate =
                                        cb.and(
                                                predicate,
                                                cb.or(
                                                        cb.like(
                                                                cb.lower(
                                                                        root.get("id")
                                                                                .get(
                                                                                        "principalName")),
                                                                like),
                                                        cb.like(
                                                                cb.lower(
                                                                        root.get("id")
                                                                                .get(
                                                                                        "registeredClientId")),
                                                                like)));
                            }
                            if (!client.isBlank()) {
                                predicate =
                                        cb.and(
                                                predicate,
                                                cb.like(
                                                        cb.lower(
                                                                root.get("id")
                                                                        .get("registeredClientId")),
                                                        "%" + client.toLowerCase() + "%"));
                            }
                            if (!principal.isBlank()) {
                                predicate =
                                        cb.and(
                                                predicate,
                                                cb.like(
                                                        cb.lower(
                                                                root.get("id")
                                                                        .get("principalName")),
                                                        "%" + principal.toLowerCase() + "%"));
                            }
                            if (!grantedScope.isBlank()) {
                                predicate =
                                        cb.and(
                                                predicate,
                                                cb.like(
                                                        cb.lower(root.get("authorities")),
                                                        "%" + grantedScope.toLowerCase() + "%"));
                            }
                            return predicate;
                        },
                        pageable);
        return toConsentViews(consents);
    }

    @Transactional(readOnly = true)
    public AdminConsentDTO consent(String clientId, String username) {
        AuthorizationConsentEntity consent =
                authorizationConsentRepository
                        .findByIdRegisteredClientIdAndIdPrincipalName(clientId, username)
                        .orElseThrow(() -> ApiException.notFound("Consent not found"));
        Map<String, String> clientNames =
                clientRepository.findById(clientId).stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        client -> client.getId(),
                                        client -> client.getClientName()));
        return consentView(consent, clientNames, userIds(java.util.List.of(consent)));
    }

    private Page<AdminConsentDTO> toConsentViews(Page<AuthorizationConsentEntity> consents) {
        Map<String, String> clientNames =
                clientRepository
                        .findAllById(
                                consents.getContent().stream()
                                        .map(consent -> consent.getId().getRegisteredClientId())
                                        .distinct()
                                        .toList())
                        .stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        client -> client.getId(),
                                        client -> client.getClientName()));
        Map<String, Long> userIds = userIds(consents.getContent());
        return consents.map(consent -> consentView(consent, clientNames, userIds));
    }

    private Map<String, Long> userIds(java.util.List<AuthorizationConsentEntity> consents) {
        return userRepository
                .findAllByUsernameIn(
                        consents.stream()
                                .map(consent -> consent.getId().getPrincipalName())
                                .distinct()
                                .toList())
                .stream()
                .collect(
                        java.util.stream.Collectors.toMap(
                                UserEntity::getUsername, UserEntity::getId));
    }

    @Transactional(readOnly = true)
    public Page<AdminConsentDTO> clientConsents(String clientId, Pageable pageable) {
        if (!clientRepository.existsById(clientId)) {
            throw ApiException.notFound("Client not found");
        }
        Map<String, String> clientNames =
                clientRepository.findById(clientId).stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        client -> client.getId(),
                                        client -> client.getClientName()));
        Page<AuthorizationConsentEntity> consents =
                authorizationConsentRepository.findByIdRegisteredClientId(clientId, pageable);
        Map<String, Long> userIds = userIds(consents.getContent());
        return consents.map(consent -> consentView(consent, clientNames, userIds));
    }

    @Transactional(readOnly = true)
    public Page<AdminConsentDTO> userConsents(
            Long userId, String currentUsername, Pageable pageable) {
        String username =
                adminUserService.requireManageableUser(userId, currentUsername).getUsername();
        Page<AuthorizationConsentEntity> consents =
                authorizationConsentRepository.findByIdPrincipalName(username, pageable);
        Map<String, String> clientNames =
                clientRepository
                        .findAllById(
                                consents.getContent().stream()
                                        .map(c -> c.getId().getRegisteredClientId())
                                        .distinct()
                                        .toList())
                        .stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        client -> client.getId(),
                                        client -> client.getClientName()));
        Map<String, Long> userIds = userIds(consents.getContent());
        return consents.map(consent -> consentView(consent, clientNames, userIds));
    }

    @Transactional
    public void revokeConsent(String clientId, String username, String currentUsername) {
        adminUserService.assertCanManageUsername(username, currentUsername);
        AuthorizationConsentId id = new AuthorizationConsentId(clientId, username);
        if (!authorizationConsentRepository.existsById(id)) {
            throw ApiException.notFound("Consent not found");
        }
        authorizationConsentRepository.deleteById(id);
        authorizationRepository.deleteByPrincipalNameAndRegisteredClientId(username, clientId);
        adminAuditEventService.record("consent.revoked", "consent", clientId + ":" + username);
    }

    private AdminConsentDTO consentView(
            AuthorizationConsentEntity consent,
            Map<String, String> clientNames,
            Map<String, Long> userIds) {
        return adminConsentMapper.toDTO(consent, clientNames, userIds, mapperSupport);
    }
}
