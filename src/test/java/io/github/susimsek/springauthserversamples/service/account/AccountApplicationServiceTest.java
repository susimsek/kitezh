package io.github.susimsek.springauthserversamples.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.AuthorizationConsentEntity;
import io.github.susimsek.springauthserversamples.domain.AuthorizationConsentId;
import io.github.susimsek.springauthserversamples.domain.AuthorizationEntity;
import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.springauthserversamples.repository.AuthorizationConsentRepository;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class AccountApplicationServiceTest {

    @Mock private AuthorizationConsentRepository consentRepository;
    @Mock private AuthorizationRepository authorizationRepository;
    @Mock private ClientRepository clientRepository;
    @Mock private AuthorizationServerMapperSupport mapperSupport;
    @Mock private AdminAuditEventService auditEventService;

    @Test
    void mapsAuthorizedApplicationsInBatches() {
        final Pageable pageable = Pageable.unpaged();
        AuthorizationConsentEntity consent = new AuthorizationConsentEntity();
        consent.setId(new AuthorizationConsentId("client-id", "alice"));
        consent.setAuthorities("serialized");
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-id");
        client.setClientName("Client One");
        when(consentRepository.findByIdPrincipalName("alice", pageable))
                .thenReturn(new PageImpl<>(List.of(consent)));
        when(clientRepository.findAllById(List.of("client-id"))).thenReturn(List.of(client));
        when(mapperSupport.readAuthorities("serialized"))
                .thenReturn(java.util.Set.of(new SimpleGrantedAuthority("openid")));

        var result = service().applications("alice", pageable).getContent();

        assertThat(result)
                .singleElement()
                .satisfies(
                        application -> {
                            assertThat(application.clientId()).isEqualTo("client-id");
                            assertThat(application.clientName()).isEqualTo("Client One");
                            assertThat(application.scopes()).containsExactly("openid");
                        });
    }

    @Test
    void revokesConsentAndClientAuthorizations() {
        AuthorizationConsentId id = new AuthorizationConsentId("client-id", "alice");
        when(consentRepository.existsById(id)).thenReturn(true);

        service().revokeApplication("alice", "client-id");

        verify(consentRepository).deleteById(id);
        verify(authorizationRepository)
                .deleteByPrincipalNameAndRegisteredClientId("alice", "client-id");
        verify(auditEventService)
                .record("account.application.revoked", "consent", "client-id:alice");
    }

    @Test
    void rejectsUnknownConsent() {
        assertThatThrownBy(() -> service().revokeApplication("alice", "missing"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void mapsOfflineSessionsInBatches() {
        AuthorizationEntity session = offlineSession("auth-1", "client-id", "alice");
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-id");
        client.setClientName("Client One");
        when(authorizationRepository
                        .findAllByPrincipalNameAndSessionIdIsNullAndRefreshTokenValueIsNotNull(
                                "alice", Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(session)));
        when(clientRepository.findAllById(List.of("client-id"))).thenReturn(List.of(client));

        var result = service().offlineSessions("alice", Pageable.unpaged()).getContent();

        assertThat(result)
                .singleElement()
                .satisfies(item -> assertThat(item.clientName()).isEqualTo("Client One"));
    }

    @Test
    void fallsBackToClientIdAndRevokesOwnedOfflineSession() {
        AuthorizationEntity session = offlineSession("auth-1", "missing-client", "alice");
        when(authorizationRepository
                        .findAllByPrincipalNameAndSessionIdIsNullAndRefreshTokenValueIsNotNull(
                                "alice", Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(session)));
        when(clientRepository.findAllById(List.of("missing-client"))).thenReturn(List.of());

        assertThat(service().offlineSessions("alice", Pageable.unpaged()).getContent())
                .singleElement()
                .extracting(item -> item.clientName())
                .isEqualTo("missing-client");

        when(authorizationRepository.findById("auth-1")).thenReturn(java.util.Optional.of(session));
        service().revokeOfflineSession("alice", "auth-1");

        verify(authorizationRepository).delete(session);
        verify(auditEventService)
                .record("account.offline-session.revoked", "offline-session", "auth-1");
    }

    @Test
    void rejectsOtherUsersAndBrowserSessions() {
        AuthorizationEntity otherUser = offlineSession("auth-1", "client-id", "bob");
        when(authorizationRepository.findById("auth-1"))
                .thenReturn(java.util.Optional.of(otherUser));

        assertThatThrownBy(() -> service().revokeOfflineSession("alice", "auth-1"))
                .isInstanceOf(ApiException.class);

        otherUser.setPrincipalName("alice");
        otherUser.setSessionId("browser-session");
        assertThatThrownBy(() -> service().revokeOfflineSession("alice", "auth-1"))
                .isInstanceOf(ApiException.class);
    }

    private static AuthorizationEntity offlineSession(String id, String clientId, String username) {
        AuthorizationEntity session = new AuthorizationEntity();
        session.setId(id);
        session.setRegisteredClientId(clientId);
        session.setPrincipalName(username);
        session.setRefreshTokenValue("refresh-token");
        return session;
    }

    private AccountApplicationService service() {
        return new AccountApplicationService(
                consentRepository,
                authorizationRepository,
                clientRepository,
                mapperSupport,
                auditEventService);
    }
}
