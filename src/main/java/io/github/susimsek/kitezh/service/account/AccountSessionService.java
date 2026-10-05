package io.github.susimsek.kitezh.service.account;

import io.github.susimsek.kitezh.domain.AuthorizationEntity;
import io.github.susimsek.kitezh.domain.UserSessionEntity;
import io.github.susimsek.kitezh.dto.account.AccountSessionDTO;
import io.github.susimsek.kitezh.mapper.AccountSessionMapper;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.repository.UserSessionRepository;
import io.github.susimsek.kitezh.security.OidcSessionIdentifier;
import io.github.susimsek.kitezh.service.SessionInvalidationService;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
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
public class AccountSessionService {

    private final UserSessionRepository userSessionRepository;
    private final AuthorizationRepository authorizationRepository;
    private final ClientRepository clientRepository;
    private final AdminAuditEventService auditEventService;
    private final SessionInvalidationService sessionInvalidationService;
    private final AccountSessionMapper accountSessionMapper;

    @Transactional(readOnly = true)
    public Page<AccountSessionDTO> sessions(
            String username, String currentSessionId, Pageable pageable) {
        Page<UserSessionEntity> sessions =
                userSessionRepository.findActiveSessionsByPrincipalName(
                        Instant.now().toEpochMilli(), username, pageable);
        return sessionViews(sessions, currentSessionId);
    }

    @Transactional
    public void deleteSession(String username, String sessionId) {
        UserSessionEntity session =
                userSessionRepository
                        .findBySessionId(sessionId)
                        .orElseThrow(() -> ApiException.notFound("Session not found"));
        if (!username.equals(session.getPrincipalName())) {
            throw ApiException.forbidden(
                    ApiErrorCode.SESSION_FORBIDDEN, "You cannot manage another user's session");
        }
        sessionInvalidationService.invalidateSession(sessionId);
        auditEventService.record("account.session.deleted", "session", sessionId);
    }

    @Transactional
    public void deleteOtherSessions(String username, String currentSessionId) {
        List<String> sessionIds =
                userSessionRepository
                        .findAllByPrincipalNameAndExpiryTimeAfter(
                                username, Instant.now().toEpochMilli())
                        .stream()
                        .map(UserSessionEntity::getSessionId)
                        .filter(
                                sessionId ->
                                        !OidcSessionIdentifier.matches(currentSessionId, sessionId))
                        .toList();
        if (sessionIds.isEmpty()) {
            return;
        }
        sessionInvalidationService.invalidateSessions(sessionIds);
        sessionIds.forEach(
                sessionId ->
                        auditEventService.record("account.session.deleted", "session", sessionId));
    }

    private Page<AccountSessionDTO> sessionViews(
            Page<UserSessionEntity> sessions, String currentSessionId) {
        List<String> sessionIds =
                sessions.getContent().stream().map(UserSessionEntity::getSessionId).toList();
        if (sessionIds.isEmpty()) {
            return sessions.map(
                    session ->
                            accountSessionMapper.toDTO(
                                    session, currentSessionId, List.of(), Map.of()));
        }
        Map<String, List<AuthorizationEntity>> authorizationsBySessionId =
                authorizationRepository
                        .findAllBySessionIdInOrderByAccessTokenIssuedAtDesc(sessionIds)
                        .stream()
                        .collect(
                                java.util.stream.Collectors.groupingBy(
                                        AuthorizationEntity::getSessionId));
        Map<String, String> clientNames =
                clientRepository
                        .findAllById(
                                authorizationsBySessionId.values().stream()
                                        .flatMap(List::stream)
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
                        accountSessionMapper.toDTO(
                                session,
                                currentSessionId,
                                authorizationsBySessionId.getOrDefault(
                                        session.getSessionId(), List.of()),
                                clientNames));
    }
}
