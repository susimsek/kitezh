package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorizationConsentEntity;
import io.github.susimsek.kitezh.domain.AuthorizationConsentId;
import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminConsentDTO;
import io.github.susimsek.kitezh.mapper.AdminConsentMapper;
import io.github.susimsek.kitezh.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.kitezh.repository.AuthorizationConsentRepository;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class AdminConsentServiceTest {
    @Mock private AdminUserService adminUserService;
    @Mock private AuthorizationConsentRepository authorizationConsentRepository;
    @Mock private AuthorizationRepository authorizationRepository;
    @Mock private ClientRepository clientRepository;
    @Mock private UserRepository userRepository;
    @Mock private AuthorizationServerMapperSupport mapperSupport;
    @Mock private AdminAuditEventService adminAuditEventService;

    @Test
    void returnsConsentsWithClientNamesAndAuthorities() {
        AuthorizationConsentEntity knownClient = consent("client-one", "alice", "openid profile");
        AuthorizationConsentEntity missingClient = consent("client-two", "bob", "email");
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-one");
        client.setClientName("Client One");
        Pageable pageable = Pageable.unpaged();
        when(authorizationConsentRepository.findAll(
                        any(org.springframework.data.jpa.domain.Specification.class),
                        org.mockito.ArgumentMatchers.eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(knownClient, missingClient)));
        when(clientRepository.findAllById(List.of("client-one", "client-two")))
                .thenReturn(List.of(client));
        UserEntity alice = new UserEntity();
        alice.setId(1L);
        alice.setUsername("alice");
        UserEntity bob = new UserEntity();
        bob.setId(2L);
        bob.setUsername("bob");
        when(userRepository.findAllByUsernameIn(List.of("alice", "bob")))
                .thenReturn(List.of(alice, bob));
        when(mapperSupport.readAuthorities("openid profile"))
                .thenReturn(
                        Set.of(
                                new SimpleGrantedAuthority("openid"),
                                new SimpleGrantedAuthority("profile")));
        when(mapperSupport.readAuthorities("email"))
                .thenReturn(Set.of(new SimpleGrantedAuthority("email")));

        List<AdminConsentDTO> result =
                service().consents("  alice  ", "", "", "", pageable).getContent();

        assertThat(result)
                .containsExactly(
                        new AdminConsentDTO(
                                "client-one",
                                "Client One",
                                "alice",
                                1L,
                                Set.of("openid", "profile"),
                                java.time.Instant.parse("2026-08-21T00:00:00Z"),
                                java.time.Instant.parse("2026-08-21T00:00:00Z")),
                        new AdminConsentDTO(
                                "client-two",
                                "client-two",
                                "bob",
                                2L,
                                Set.of("email"),
                                java.time.Instant.parse("2026-08-21T00:00:00Z"),
                                java.time.Instant.parse("2026-08-21T00:00:00Z")));
        verify(authorizationConsentRepository)
                .findAll(
                        any(org.springframework.data.jpa.domain.Specification.class),
                        org.mockito.ArgumentMatchers.eq(pageable));
        verify(clientRepository).findAllById(List.of("client-one", "client-two"));
        verify(mapperSupport).readAuthorities("openid profile");
        verify(mapperSupport).readAuthorities("email");
    }

    @Test
    void returnsEmptyConsentsWithoutLoadingClients() {
        Pageable pageable = Pageable.unpaged();
        when(authorizationConsentRepository.findAll(
                        any(org.springframework.data.jpa.domain.Specification.class),
                        org.mockito.ArgumentMatchers.eq(pageable)))
                .thenReturn(Page.empty(pageable));

        assertThat(service().consents(null, "", "", "", pageable).getContent()).isEmpty();

        verify(authorizationConsentRepository)
                .findAll(
                        any(org.springframework.data.jpa.domain.Specification.class),
                        org.mockito.ArgumentMatchers.eq(pageable));
        verify(clientRepository).findAllById(List.of());
        verifyNoInteractions(mapperSupport);
    }

    @Test
    void revokesConsentAndRelatedAuthorizations() {
        AuthorizationConsentId id = new AuthorizationConsentId("client", "user");
        when(authorizationConsentRepository.existsById(id)).thenReturn(true);

        service().revokeConsent("client", "user", "admin");

        verify(adminUserService).assertCanManageUsername("user", "admin");
        verify(authorizationConsentRepository).deleteById(id);
        verify(authorizationRepository)
                .deleteByPrincipalNameAndRegisteredClientId("user", "client");
        verify(adminAuditEventService).record("consent.revoked", "consent", "client:user");
    }

    @Test
    void rejectsRevokingUnknownConsentWithoutDeletingAnything() {
        AuthorizationConsentId id = new AuthorizationConsentId("client", "user");
        when(authorizationConsentRepository.existsById(id)).thenReturn(false);

        assertThatThrownBy(() -> service().revokeConsent("client", "user", "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Consent not found");

        verify(adminUserService).assertCanManageUsername("user", "admin");
        verify(authorizationConsentRepository).existsById(id);
        verifyNoInteractions(authorizationRepository, adminAuditEventService);
    }

    @Test
    void loadsSingleClientAndUserConsentViews() {
        final AuthorizationConsentEntity consent = consent("client", "alice", "openid");
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client");
        client.setClientName("Client");
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        when(authorizationConsentRepository.findByIdRegisteredClientIdAndIdPrincipalName(
                        "client", "alice"))
                .thenReturn(Optional.of(consent));
        when(clientRepository.findById("client")).thenReturn(Optional.of(client));
        when(userRepository.findAllByUsernameIn(List.of("alice"))).thenReturn(List.of(user));
        when(mapperSupport.readAuthorities("openid"))
                .thenReturn(Set.of(new SimpleGrantedAuthority("openid")));

        assertThat(service().consent("client", "alice").clientName()).isEqualTo("Client");

        when(adminUserService.requireManageableUser(7L, "admin")).thenReturn(user);
        when(authorizationConsentRepository.findByIdPrincipalName("alice", Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(consent)));
        when(clientRepository.findAllById(List.of("client"))).thenReturn(List.of(client));
        assertThat(service().userConsents(7L, "admin", Pageable.unpaged()).getContent()).hasSize(1);
    }

    @Test
    void validatesClientConsentLookups() {
        when(clientRepository.existsById("missing")).thenReturn(false);
        assertThatThrownBy(() -> service().clientConsents("missing", Pageable.unpaged()))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client not found");

        when(authorizationConsentRepository.findByIdRegisteredClientIdAndIdPrincipalName(
                        "client", "alice"))
                .thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().consent("client", "alice"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Consent not found");
    }

    @Test
    void appliesAllConsentSearchFilters() {
        Pageable pageable = Pageable.unpaged();
        when(authorizationConsentRepository.findAll(
                        any(org.springframework.data.jpa.domain.Specification.class),
                        org.mockito.ArgumentMatchers.eq(pageable)))
                .thenReturn(Page.empty(pageable));

        service().consents("alice", "client", "alice", "openid", pageable);

        ArgumentCaptor<
                        org.springframework.data.jpa.domain.Specification<
                                AuthorizationConsentEntity>>
                specification =
                        ArgumentCaptor.forClass(
                                org.springframework.data.jpa.domain.Specification.class);
        verify(authorizationConsentRepository)
                .findAll(specification.capture(), org.mockito.ArgumentMatchers.eq(pageable));

        CriteriaBuilder criteriaBuilder = mock(CriteriaBuilder.class);
        CriteriaQuery<?> criteriaQuery = mock(CriteriaQuery.class);
        Root<AuthorizationConsentEntity> root = mock(Root.class);
        Path<Object> idPath = mock(Path.class);
        Path<String> valuePath = mock(Path.class);
        Predicate predicate = mock(Predicate.class);
        when(criteriaBuilder.conjunction()).thenReturn(predicate);
        when(criteriaBuilder.and(any(Predicate.class), any(Predicate.class))).thenReturn(predicate);
        when(criteriaBuilder.or(any(Predicate.class), any(Predicate.class))).thenReturn(predicate);
        when(criteriaBuilder.like(any(Expression.class), anyString())).thenReturn(predicate);
        when(criteriaBuilder.lower(any(Expression.class))).thenReturn(valuePath);
        when(root.get("id")).thenReturn(idPath);
        doReturn(valuePath).when(idPath).get(anyString());
        doReturn(valuePath).when(root).get("authorities");

        assertThat(specification.getValue().toPredicate(root, criteriaQuery, criteriaBuilder))
                .isSameAs(predicate);
        verify(criteriaBuilder, org.mockito.Mockito.atLeast(4))
                .like(any(Expression.class), anyString());
    }

    @Test
    void returnsClientConsentsAndFallsBackForMissingClientName() {
        AuthorizationConsentEntity consent = consent("client", "alice", "openid");
        when(clientRepository.existsById("client")).thenReturn(true);
        when(clientRepository.findById("client")).thenReturn(Optional.empty());
        when(authorizationConsentRepository.findByIdRegisteredClientId(
                        "client", Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(consent)));
        when(userRepository.findAllByUsernameIn(List.of("alice"))).thenReturn(List.of());
        when(mapperSupport.readAuthorities("openid"))
                .thenReturn(Set.of(new SimpleGrantedAuthority("openid")));

        AdminConsentDTO result =
                service().clientConsents("client", Pageable.unpaged()).getContent().getFirst();

        assertThat(result.clientName()).isEqualTo("client");
        assertThat(result.userId()).isNull();
    }

    private static AuthorizationConsentEntity consent(
            String clientId, String principalName, String authorities) {
        AuthorizationConsentEntity entity =
                new AuthorizationConsentEntity(
                        new AuthorizationConsentId(clientId, principalName), authorities);
        entity.setCreatedAt(java.time.Instant.parse("2026-08-21T00:00:00Z"));
        entity.setUpdatedAt(java.time.Instant.parse("2026-08-21T00:00:00Z"));
        return entity;
    }

    private AdminConsentService service() {
        return new AdminConsentService(
                adminUserService,
                authorizationConsentRepository,
                authorizationRepository,
                clientRepository,
                userRepository,
                mapperSupport,
                adminAuditEventService,
                Mappers.getMapper(AdminConsentMapper.class));
    }
}
