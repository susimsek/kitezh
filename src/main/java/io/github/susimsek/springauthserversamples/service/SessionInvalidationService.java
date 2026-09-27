package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.repository.UserSessionRepository;
import java.util.Collection;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Atomically removes browser sessions together with their OAuth2 authorizations. */
@Service
@RequiredArgsConstructor
public class SessionInvalidationService {

    private final UserSessionRepository userSessionRepository;
    private final AuthorizationRepository authorizationRepository;

    @Transactional
    public void invalidateSession(String sessionId) {
        userSessionRepository.deleteBySessionId(sessionId);
        authorizationRepository.deleteBySessionId(sessionId);
    }

    @Transactional
    public void invalidateAuthorizations(String sessionId) {
        authorizationRepository.deleteBySessionId(sessionId);
    }

    @Transactional
    public void invalidateSessions(Collection<String> sessionIds) {
        if (sessionIds.isEmpty()) {
            return;
        }
        userSessionRepository.deleteBySessionIdIn(sessionIds);
        authorizationRepository.deleteBySessionIdIn(sessionIds);
    }

    @Transactional
    public void invalidatePrincipal(String username) {
        userSessionRepository.deleteByPrincipalName(username);
        authorizationRepository.deleteByPrincipalName(username);
    }

    @Transactional
    public void invalidatePrincipalExceptSession(String username, String currentSessionId) {
        userSessionRepository.deleteByPrincipalNameAndSessionIdNot(username, currentSessionId);
        authorizationRepository.deleteByPrincipalNameAndSessionIdNot(username, currentSessionId);
    }
}
