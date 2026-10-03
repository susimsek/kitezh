package io.github.susimsek.springauthserversamples.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.AuthorizationEntity;
import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.domain.UserSessionEntity;
import io.github.susimsek.springauthserversamples.mapper.AccountSessionMapper;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.UserSessionRepository;
import io.github.susimsek.springauthserversamples.security.OidcSessionIdentifier;
import io.github.susimsek.springauthserversamples.service.SessionInvalidationService;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class AccountSessionServiceTest {

    @Mock private UserSessionRepository userSessionRepository;
    @Mock private AuthorizationRepository authorizationRepository;
    @Mock private ClientRepository clientRepository;
    @Mock private AdminAuditEventService auditEventService;
    @Mock private SessionInvalidationService sessionInvalidationService;

    @Test
    void loadsSessionAuthorizationClientsInBatches() {
        Pageable pageable = Pageable.unpaged();
        UserSessionEntity firstSession = session("session-1");
        UserSessionEntity secondSession = session("session-2");
        when(userSessionRepository.findActiveSessionsByPrincipalName(
                        anyLong(), eq("alice"), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(firstSession, secondSession)));
        when(authorizationRepository.findAllBySessionIdInOrderByAccessTokenIssuedAtDesc(
                        List.of("session-1", "session-2")))
                .thenReturn(
                        List.of(
                                authorization("authorization-1", "session-1", "client-1"),
                                authorization("authorization-2", "session-1", "client-2"),
                                authorization("authorization-3", "session-2", "client-1")));
        when(clientRepository.findAllById(List.of("client-1", "client-2")))
                .thenReturn(
                        List.of(
                                client("client-1", "First Client"),
                                client("client-2", "Second Client")));

        var result =
                service()
                        .sessions(
                                "alice", OidcSessionIdentifier.fromSessionId("session-1"), pageable)
                        .getContent();

        assertThat(result).hasSize(2);
        assertThat(result.getFirst().current()).isTrue();
        assertThat(result.getFirst().clients())
                .extracting(client -> client.clientName())
                .containsExactly("First Client", "Second Client");
        assertThat(result.get(1).clients())
                .extracting(client -> client.clientName())
                .containsExactly("First Client");
        verify(authorizationRepository)
                .findAllBySessionIdInOrderByAccessTokenIssuedAtDesc(
                        List.of("session-1", "session-2"));
        verify(clientRepository).findAllById(List.of("client-1", "client-2"));
    }

    @Test
    void deletesEverySessionExceptTheOneMatchingTheOidcSessionId() {
        when(userSessionRepository.findAllByPrincipalNameAndExpiryTimeAfter(eq("alice"), anyLong()))
                .thenReturn(List.of(session("session-1"), session("session-2")));

        service().deleteOtherSessions("alice", OidcSessionIdentifier.fromSessionId("session-1"));

        verify(sessionInvalidationService).invalidateSessions(List.of("session-2"));
    }

    @Test
    void deletesOneOwnedSessionAndRejectsMissingOrForeignSessions() {
        UserSessionEntity owned = session("session-1");
        owned.setPrincipalName("alice");
        when(userSessionRepository.findBySessionId("session-1")).thenReturn(Optional.of(owned));

        service().deleteSession("alice", "session-1");

        verify(sessionInvalidationService).invalidateSession("session-1");
        verify(auditEventService).record("account.session.deleted", "session", "session-1");

        owned.setPrincipalName("bob");
        assertThatThrownBy(() -> service().deleteSession("alice", "session-1"))
                .isInstanceOf(ApiException.class);
        when(userSessionRepository.findBySessionId("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().deleteSession("alice", "missing"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void mapsEmptySessionPagesAndSkipsInvalidationWhenNoOtherSessionsExist() {
        when(userSessionRepository.findActiveSessionsByPrincipalName(
                        anyLong(), eq("alice"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        assertThat(service().sessions("alice", "session-1", Pageable.unpaged())).isEmpty();

        when(userSessionRepository.findAllByPrincipalNameAndExpiryTimeAfter(eq("alice"), anyLong()))
                .thenReturn(List.of(session("session-1")));
        service().deleteOtherSessions("alice", OidcSessionIdentifier.fromSessionId("session-1"));
        verify(sessionInvalidationService, never()).invalidateSessions(any());

        try {
            var mapper =
                    AccountSessionService.class.getDeclaredMethod(
                            "lambda$sessionViews$0", String.class, UserSessionEntity.class);
            mapper.setAccessible(true);
            mapper.invoke(service(), "session-1", session("session-2"));
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError(exception);
        }
    }

    private AccountSessionService service() {
        return new AccountSessionService(
                userSessionRepository,
                authorizationRepository,
                clientRepository,
                auditEventService,
                sessionInvalidationService,
                Mappers.getMapper(AccountSessionMapper.class));
    }

    private static UserSessionEntity session(String sessionId) {
        UserSessionEntity session = new UserSessionEntity();
        session.setSessionId(sessionId);
        session.setCreationTime(1_000L);
        session.setLastAccessTime(1_100L);
        session.setExpiryTime(1_200L);
        return session;
    }

    private static AuthorizationEntity authorization(String id, String sessionId, String clientId) {
        AuthorizationEntity authorization = new AuthorizationEntity();
        authorization.setId(id);
        authorization.setSessionId(sessionId);
        authorization.setRegisteredClientId(clientId);
        return authorization;
    }

    private static RegisteredClientEntity client(String id, String clientName) {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId(id);
        client.setClientName(clientName);
        return client;
    }
}
