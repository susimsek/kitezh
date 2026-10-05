package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorizationEntity;
import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class AdminOfflineSessionServiceTest {

    @Mock private AuthorizationRepository authorizationRepository;
    @Mock private ClientRepository clientRepository;
    @Mock private AdminUserService adminUserService;
    @Mock private AdminAuditEventService auditEventService;

    @Test
    void mapsClientNamesAndFallsBackToClientId() {
        AuthorizationEntity first = session("auth-1", "client-1", "alice");
        AuthorizationEntity second = session("auth-2", "client-2", "bob");
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-1");
        client.setClientName("Client One");
        when(authorizationRepository.findAllBySessionIdIsNullAndRefreshTokenValueIsNotNull(
                        Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(first, second)));
        when(clientRepository.findAllById(List.of("client-1", "client-2")))
                .thenReturn(List.of(client));

        var result = service().sessions(Pageable.unpaged()).getContent();

        assertThat(result)
                .extracting(item -> item.clientName())
                .containsExactly("Client One", "client-2");
    }

    @Test
    void revokesAuthorizedOfflineSession() {
        AuthorizationEntity session = session("auth-1", "client-1", "alice");
        when(authorizationRepository.findById("auth-1")).thenReturn(Optional.of(session));

        service().revoke("auth-1", "admin");

        verify(adminUserService).assertCanManageUsername("alice", "admin");
        verify(authorizationRepository).delete(session);
        verify(auditEventService).record("offline-session.revoked", "offline-session", "auth-1");
    }

    @Test
    void rejectsMissingOrBrowserSession() {
        AdminOfflineSessionService target = service();
        when(authorizationRepository.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> target.revoke("missing", "admin"))
                .isInstanceOf(ApiException.class);

        AuthorizationEntity browserSession = session("auth-1", "client-1", "alice");
        browserSession.setSessionId("browser-session");
        when(authorizationRepository.findById("auth-1")).thenReturn(Optional.of(browserSession));
        assertThatThrownBy(() -> target.revoke("auth-1", "admin")).isInstanceOf(ApiException.class);
    }

    private AdminOfflineSessionService service() {
        return new AdminOfflineSessionService(
                authorizationRepository, clientRepository, adminUserService, auditEventService);
    }

    private static AuthorizationEntity session(String id, String clientId, String username) {
        AuthorizationEntity session = new AuthorizationEntity();
        session.setId(id);
        session.setRegisteredClientId(clientId);
        session.setPrincipalName(username);
        session.setRefreshTokenValue("refresh-token");
        return session;
    }
}
