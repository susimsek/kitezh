package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.AuthorizationEntity;
import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import io.github.susimsek.kitezh.domain.UserSessionEntity;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSessionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSessionDetailDTO;
import io.github.susimsek.kitezh.mapper.AdminSessionMapper;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.repository.UserSessionRepository;
import io.github.susimsek.kitezh.service.AuthorizationRevocationPolicyService;
import io.github.susimsek.kitezh.service.SessionInvalidationService;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminSessionService {

    private static final String ACTIVE_STATUS = "active";

    private final AdminUserService adminUserService;
    private final UserSessionRepository userSessionRepository;
    private final AuthorizationRepository authorizationRepository;
    private final ClientRepository clientRepository;
    private final AdminAuditEventService adminAuditEventService;
    private final SessionInvalidationService sessionInvalidationService;
    private final AuthorizationRevocationPolicyService revocationPolicyService;
    private final AdminSessionMapper adminSessionMapper;

    @Transactional(readOnly = true)
    public Page<AdminSessionDTO> sessions(
            String query, String clientId, String status, Pageable pageable) {
        long now = Instant.now().toEpochMilli();
        String normalizedQuery = AdminSearch.normalize(query);
        String normalizedStatus = normalizeStatus(status);
        if (clientId == null || clientId.isBlank()) {
            return mapSessions(
                    userSessionRepository.findSessions(
                            now, normalizedQuery, normalizedStatus, pageable));
        }
        var client =
                clientRepository
                        .findByClientId(clientId.trim())
                        .orElseThrow(() -> ApiException.notFound("Client not found"));
        List<String> sessionIds =
                authorizationRepository.findDistinctSessionIdsByRegisteredClientId(client.getId());
        if (sessionIds.isEmpty()) {
            return Page.empty(pageable);
        }
        return mapSessions(
                userSessionRepository.findSessionsBySessionIdIn(
                        now, normalizedQuery, normalizedStatus, sessionIds, pageable));
    }

    @Transactional(readOnly = true)
    public AdminSessionDetailDTO session(String sessionId, String currentUsername) {
        UserSessionEntity session =
                userSessionRepository
                        .findBySessionId(sessionId)
                        .orElseThrow(() -> ApiException.notFound("Session not found"));
        adminUserService.assertCanManageUsername(session.getPrincipalName(), currentUsername);
        List<AuthorizationEntity> authorizations =
                authorizationRepository.findAllBySessionIdOrderByAccessTokenIssuedAtDesc(sessionId);
        Map<String, RegisteredClientEntity> clients =
                clientRepository
                        .findAllById(
                                authorizations.stream()
                                        .map(AuthorizationEntity::getRegisteredClientId)
                                        .distinct()
                                        .toList())
                        .stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        client -> client.getId(), client -> client));
        List<AdminAuthorizationDTO> authorizationViews =
                authorizations.stream()
                        .map(
                                authorization ->
                                        adminSessionMapper.toAuthorizationDTO(
                                                authorization,
                                                clients.get(authorization.getRegisteredClientId())))
                        .toList();
        Map<String, Long> counts = Map.of(sessionId, (long) authorizationViews.size());
        return adminSessionMapper.toDetailDTO(session, counts, authorizationViews);
    }

    @Transactional(readOnly = true)
    public Page<AdminSessionDTO> userSessions(
            Long userId, String currentUsername, Pageable pageable) {
        String username =
                adminUserService.requireManageableUser(userId, currentUsername).getUsername();
        return mapSessions(
                userSessionRepository.findActiveSessionsByPrincipalName(
                        Instant.now().toEpochMilli(), username, pageable));
    }

    @Transactional(readOnly = true)
    public Page<AdminSessionDTO> clientSessions(String clientId, Pageable pageable) {
        if (!clientRepository.existsById(clientId)) {
            throw ApiException.notFound("Client not found");
        }
        List<String> sessionIds =
                authorizationRepository.findDistinctSessionIdsByRegisteredClientId(clientId);
        if (sessionIds.isEmpty()) {
            return Page.empty(pageable);
        }
        return mapSessions(
                userSessionRepository.findActiveSessionsBySessionIdIn(
                        Instant.now().toEpochMilli(), sessionIds, pageable));
    }

    private Page<AdminSessionDTO> mapSessions(Page<UserSessionEntity> sessions) {
        List<String> sessionIds =
                sessions.getContent().stream().map(UserSessionEntity::getSessionId).toList();
        Map<String, Long> authorizationCounts =
                sessionIds.isEmpty()
                        ? Map.of()
                        : authorizationRepository.countBySessionIdIn(sessionIds).stream()
                                .collect(
                                        java.util.stream.Collectors.toMap(
                                                AuthorizationRepository.SessionAuthorizationCount
                                                        ::getSessionId,
                                                AuthorizationRepository.SessionAuthorizationCount
                                                        ::getAuthorizationCount));
        return sessions.map(session -> adminSessionMapper.toDTO(session, authorizationCounts));
    }

    @Transactional
    public void deleteSession(String sessionId, String currentUsername) {
        UserSessionEntity session =
                userSessionRepository
                        .findBySessionId(sessionId)
                        .orElseThrow(() -> ApiException.notFound("Session not found"));
        adminUserService.assertCanManageUsername(session.getPrincipalName(), currentUsername);
        sessionInvalidationService.invalidateSession(sessionId);
        adminAuditEventService.record("session.deleted", "session", sessionId);
    }

    @Transactional
    public void deleteUserSessions(String username, String currentUsername) {
        adminUserService.assertCanManageUsername(username, currentUsername);
        sessionInvalidationService.invalidatePrincipal(username);
        adminAuditEventService.record("user.sessions.deleted", "user", username);
    }

    @Transactional
    public void deleteAllSessions() {
        sessionInvalidationService.invalidateAll();
        adminAuditEventService.record("sessions.deleted", "application", "default");
    }

    @Transactional
    public void deleteClientSession(String clientId, String sessionId) {
        if (!clientRepository.existsById(clientId)) {
            throw ApiException.notFound("Client not found");
        }
        if (!authorizationRepository.existsByRegisteredClientIdAndSessionId(clientId, sessionId)) {
            throw ApiException.notFound("Client session not found");
        }
        sessionInvalidationService.invalidateClientSession(clientId, sessionId);
        adminAuditEventService.record("client.session.deleted", "client", clientId);
    }

    @Transactional
    public void deleteClientSessions(String clientId) {
        if (!clientRepository.existsById(clientId)) {
            throw ApiException.notFound("Client not found");
        }
        sessionInvalidationService.invalidateClientSessions(clientId);
        adminAuditEventService.record("client.sessions.deleted", "client", clientId);
    }

    @Transactional
    public void revokeAllTokens() {
        revocationPolicyService.revokeApplication();
        adminAuditEventService.record("tokens.revoked", "application", "default");
    }

    @Transactional
    public void revokeUserTokens(String username, String currentUsername) {
        adminUserService.assertCanManageUsername(username, currentUsername);
        revocationPolicyService.revokeUser(username);
        adminAuditEventService.record("user.tokens.revoked", "user", username);
    }

    @Transactional
    public void revokeClientTokens(String clientId) {
        RegisteredClientEntity client =
                clientRepository
                        .findById(clientId)
                        .orElseThrow(() -> ApiException.notFound("Client not found"));
        revocationPolicyService.revokeClient(client.getClientId());
        adminAuditEventService.record("client.tokens.revoked", "client", clientId);
    }

    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return ACTIVE_STATUS;
        }
        String normalized = status.trim().toLowerCase(java.util.Locale.ROOT);
        return switch (normalized) {
            case ACTIVE_STATUS, "expired", "all" -> normalized;
            default -> ACTIVE_STATUS;
        };
    }
}
