package io.github.susimsek.springauthserversamples.service;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.repository.UserSessionRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SessionInvalidationServiceTest {

    @Mock private UserSessionRepository userSessionRepository;
    @Mock private AuthorizationRepository authorizationRepository;
    @InjectMocks private SessionInvalidationService service;

    @Test
    void invalidatesOneSessionAndItsAuthorizations() {
        service.invalidateSession("session-id");

        verify(userSessionRepository).deleteBySessionId("session-id");
        verify(authorizationRepository).deleteBySessionId("session-id");
    }

    @Test
    void invalidatesMultipleSessionsAndTheirAuthorizations() {
        List<String> sessionIds = List.of("first", "second");

        service.invalidateSessions(sessionIds);

        verify(userSessionRepository).deleteBySessionIdIn(sessionIds);
        verify(authorizationRepository).deleteBySessionIdIn(sessionIds);
    }

    @Test
    void ignoresAnEmptySessionCollection() {
        service.invalidateSessions(List.of());

        verify(userSessionRepository, never()).deleteBySessionIdIn(List.of());
        verify(authorizationRepository, never()).deleteBySessionIdIn(List.of());
    }

    @Test
    void invalidatesAllPrincipalState() {
        service.invalidatePrincipal("alice");

        verify(userSessionRepository).deleteByPrincipalName("alice");
        verify(authorizationRepository).deleteByPrincipalName("alice");
    }

    @Test
    void preservesCurrentSessionWhileInvalidatingOtherPrincipalState() {
        service.invalidatePrincipalExceptSession("alice", "current-session");

        verify(userSessionRepository)
                .deleteByPrincipalNameAndSessionIdNot("alice", "current-session");
        verify(authorizationRepository)
                .deleteByPrincipalNameAndSessionIdNot("alice", "current-session");
    }
}
