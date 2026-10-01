package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.domain.AuthorizationEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminOfflineSessionDTO;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminOfflineSessionService {

    private final AuthorizationRepository authorizationRepository;
    private final ClientRepository clientRepository;
    private final AdminUserService adminUserService;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public Page<AdminOfflineSessionDTO> sessions(Pageable pageable) {
        Page<AuthorizationEntity> sessions =
                authorizationRepository.findAllBySessionIdIsNullAndRefreshTokenValueIsNotNull(
                        pageable);
        Map<String, String> clientNames =
                clientRepository
                        .findAllById(
                                sessions.getContent().stream()
                                        .map(AuthorizationEntity::getRegisteredClientId)
                                        .distinct()
                                        .toList())
                        .stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        client -> client.getId(),
                                        client -> client.getClientName()));
        return sessions.map(
                session ->
                        new AdminOfflineSessionDTO(
                                session.getId(),
                                session.getPrincipalName(),
                                session.getRegisteredClientId(),
                                clientNames.getOrDefault(
                                        session.getRegisteredClientId(),
                                        session.getRegisteredClientId()),
                                session.getRefreshTokenIssuedAt(),
                                session.getRefreshTokenExpiresAt()));
    }

    @Transactional
    public void revoke(String id, String currentUsername) {
        AuthorizationEntity session =
                authorizationRepository
                        .findById(id)
                        .filter(entity -> entity.getSessionId() == null)
                        .orElseThrow(() -> ApiException.notFound("Offline session not found"));
        adminUserService.assertCanManageUsername(session.getPrincipalName(), currentUsername);
        authorizationRepository.delete(session);
        auditEventService.record("offline-session.revoked", "offline-session", id);
    }
}
