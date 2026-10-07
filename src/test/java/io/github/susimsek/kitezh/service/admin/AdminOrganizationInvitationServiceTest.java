package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.OrganizationInvitationEntity;
import io.github.susimsek.kitezh.domain.OrganizationInvitationStatus;
import io.github.susimsek.kitezh.domain.OrganizationMemberEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationInvitationRepository;
import io.github.susimsek.kitezh.repository.OrganizationMemberRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.mail.MailService;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationInvitationServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationInvitationRepository invitationRepository;
    @Mock private OrganizationMemberRepository memberRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;
    @Mock private AdminAuditEventService adminAuditEventService;
    @Mock private MailService mailService;

    @Test
    void createsAndListsInvitationWithOneTimeToken() {
        OrganizationEntity organization = organization(8L);
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(invitationRepository.existsByOrganizationIdAndEmailIgnoreCaseAndStatus(
                        8L, "alice@example.com", OrganizationInvitationStatus.PENDING))
                .thenReturn(false);
        when(invitationRepository.save(any(OrganizationInvitationEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationInvitationEntity saved = invocation.getArgument(0);
                            saved.setId(12L);
                            return saved;
                        });

        var created =
                service()
                        .create(
                                8L,
                                new AdminOrganizationInvitationRequestDTO(
                                        " Alice@Example.com ", " Alice ", null));

        assertThat(created.id()).isEqualTo(12L);
        assertThat(created.email()).isEqualTo("alice@example.com");
        assertThat(created.token()).isNotBlank();
        assertThat(created.expiresAt()).isAfter(Instant.now());
        verify(adminAuditEventService)
                .record(
                        "organization.invitation.created",
                        "organization",
                        "8",
                        "email=alice@example.com");

        OrganizationInvitationEntity listed =
                invitation(12L, organization, "alice@example.com", Instant.now().plusSeconds(60));
        when(invitationRepository.findByOrganizationId(8L, Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of(listed)));
        assertThat(service().findAll(8L, Pageable.ofSize(20)).getContent().getFirst().token())
                .isNull();
    }

    @Test
    void acceptsInvitationForMatchingUserAndAddsUnmanagedMember() {
        OrganizationEntity organization = organization(8L);
        UserEntity user = user(2L, "alice", "alice@example.com");
        OrganizationInvitationEntity invitation =
                invitation(12L, organization, "alice@example.com", Instant.now().plusSeconds(300));
        when(invitationRepository.findByTokenHash(anyString())).thenReturn(Optional.of(invitation));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(memberRepository.existsByOrganizationIdAndUserId(8L, 2L)).thenReturn(false);

        var result = service().accept("raw-token", "alice");

        assertThat(result.organizationId()).isEqualTo(8L);
        assertThat(result.organizationAlias()).isEqualTo("acme");
        assertThat(invitation.getStatus()).isEqualTo(OrganizationInvitationStatus.ACCEPTED);
        assertThat(invitation.getAcceptedAt()).isNotNull();
        verify(memberRepository).save(any(OrganizationMemberEntity.class));
        verify(userAccessInvalidationService).invalidate("alice");
        verify(adminAuditEventService)
                .record("organization.invitation.accepted", "organization", "8", "userId=2");
    }

    @Test
    void handlesInvitationValidationFailures() {
        assertThatThrownBy(() -> service().accept(" ", "alice")).isInstanceOf(ApiException.class);
        when(invitationRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().accept("unknown", "alice"))
                .isInstanceOf(ApiException.class);

        OrganizationEntity organization = organization(8L);
        OrganizationInvitationEntity accepted =
                invitation(12L, organization, "alice@example.com", Instant.now().plusSeconds(300));
        accepted.setStatus(OrganizationInvitationStatus.ACCEPTED);
        when(invitationRepository.findByTokenHash(anyString())).thenReturn(Optional.of(accepted));
        assertThatThrownBy(() -> service().accept("accepted", "alice"))
                .isInstanceOf(ApiException.class);

        OrganizationInvitationEntity expired =
                invitation(13L, organization, "alice@example.com", Instant.now().minusSeconds(1));
        when(invitationRepository.findByTokenHash(anyString())).thenReturn(Optional.of(expired));
        assertThatThrownBy(() -> service().accept("expired", "alice"))
                .isInstanceOf(ApiException.class);
        assertThat(expired.getStatus()).isEqualTo(OrganizationInvitationStatus.EXPIRED);

        when(invitationRepository.findByTokenHash(anyString()))
                .thenReturn(
                        Optional.of(
                                invitation(
                                        14L,
                                        organization,
                                        "alice@example.com",
                                        Instant.now().plusSeconds(300))));
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().accept("missing", "missing"))
                .isInstanceOf(ApiException.class);

        UserEntity wrongUser = user(3L, "bob", "bob@example.com");
        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(wrongUser));
        assertThatThrownBy(() -> service().accept("wrong-email", "bob"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsDuplicateInvitationAndKeepsExistingMember() {
        OrganizationEntity organization = organization(8L);
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(invitationRepository.existsByOrganizationIdAndEmailIgnoreCaseAndStatus(
                        8L, "alice@example.com", OrganizationInvitationStatus.PENDING))
                .thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                8L,
                                                new AdminOrganizationInvitationRequestDTO(
                                                        "alice@example.com", null, 24)))
                .isInstanceOf(ApiException.class);

        UserEntity user = user(2L, "alice", "alice@example.com");
        OrganizationInvitationEntity invitation =
                invitation(12L, organization, "alice@example.com", Instant.now().plusSeconds(300));
        when(invitationRepository.findByTokenHash(anyString())).thenReturn(Optional.of(invitation));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(memberRepository.existsByOrganizationIdAndUserId(8L, 2L)).thenReturn(true);
        service().accept("existing-member", "alice");
        verify(userAccessInvalidationService, org.mockito.Mockito.never()).invalidate("alice");
    }

    @Test
    void resendsAndCancelsPendingInvitation() {
        OrganizationEntity organization = organization(8L);
        OrganizationInvitationEntity invitation =
                invitation(12L, organization, "alice@example.com", Instant.now().minusSeconds(1));
        when(invitationRepository.findByOrganizationIdAndId(8L, 12L))
                .thenReturn(Optional.of(invitation));

        var resent =
                service()
                        .resend(
                                8L,
                                12L,
                                new AdminOrganizationInvitationRequestDTO(
                                        "alice@example.com", "Alice", 24));
        service().cancel(8L, 12L);

        assertThat(resent.token()).isNotBlank();
        assertThat(invitation.getStatus()).isEqualTo(OrganizationInvitationStatus.CANCELLED);
        verify(adminAuditEventService)
                .record(
                        "organization.invitation.resent",
                        "organization",
                        "8",
                        "email=alice@example.com");
        verify(adminAuditEventService)
                .record(
                        "organization.invitation.cancelled",
                        "organization",
                        "8",
                        "email=alice@example.com");
    }

    @Test
    void validatesResendAndCancelStatesAndSendsEmail() {
        OrganizationEntity organization = organization(8L);
        OrganizationInvitationEntity invitation =
                invitation(12L, organization, "alice@example.com", Instant.now().plusSeconds(300));
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(invitationRepository.findByOrganizationIdAndId(8L, 12L))
                .thenReturn(Optional.of(invitation));
        when(invitationRepository.save(any(OrganizationInvitationEntity.class)))
                .thenReturn(invitation);
        var service = service();
        ReflectionTestUtils.setField(service, "mailService", mailService);

        service.create(
                8L, new AdminOrganizationInvitationRequestDTO("alice@example.com", null, 24));
        verify(mailService)
                .sendOrganizationInvitation(
                        anyString(),
                        org.mockito.ArgumentMatchers.isNull(),
                        anyString(),
                        anyString(),
                        org.mockito.ArgumentMatchers.any());

        assertThatThrownBy(
                        () ->
                                service.resend(
                                        8L,
                                        12L,
                                        new AdminOrganizationInvitationRequestDTO(
                                                "other@example.com", null, 24)))
                .isInstanceOf(ApiException.class);

        invitation.setStatus(OrganizationInvitationStatus.ACCEPTED);
        assertThatThrownBy(
                        () ->
                                service.resend(
                                        8L,
                                        12L,
                                        new AdminOrganizationInvitationRequestDTO(
                                                "alice@example.com", null, 24)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.cancel(8L, 12L)).isInstanceOf(ApiException.class);
    }

    @Test
    void marksExpiredInvitationsWhenListing() {
        OrganizationEntity organization = organization(8L);
        OrganizationInvitationEntity expired =
                invitation(12L, organization, "alice@example.com", Instant.now().minusSeconds(1));
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(invitationRepository.findByOrganizationId(8L, Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of(expired)));

        assertThat(service().findAll(8L, Pageable.ofSize(20)).getContent().getFirst().status())
                .isEqualTo(OrganizationInvitationStatus.EXPIRED);

        when(invitationRepository.findByOrganizationIdAndId(99L, 12L)).thenReturn(Optional.empty());
        assertThatThrownBy(
                        () ->
                                service()
                                        .resend(
                                                99L,
                                                12L,
                                                new AdminOrganizationInvitationRequestDTO(
                                                        "alice@example.com", null, 24)))
                .isInstanceOf(ApiException.class);

        when(organizationRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().findAll(99L, Pageable.ofSize(20)))
                .isInstanceOf(ApiException.class);
    }

    private AdminOrganizationInvitationService service() {
        return new AdminOrganizationInvitationService(
                organizationRepository,
                invitationRepository,
                memberRepository,
                userRepository,
                userAccessInvalidationService,
                adminAuditEventService);
    }

    private static OrganizationEntity organization(Long id) {
        OrganizationEntity entity = new OrganizationEntity();
        entity.setId(id);
        entity.setAlias("acme");
        entity.setName("Acme");
        return entity;
    }

    private static UserEntity user(Long id, String username, String email) {
        UserEntity entity = new UserEntity();
        entity.setId(id);
        entity.setUsername(username);
        entity.setEmail(email);
        return entity;
    }

    private static OrganizationInvitationEntity invitation(
            Long id, OrganizationEntity organization, String email, Instant expiresAt) {
        OrganizationInvitationEntity entity = new OrganizationInvitationEntity();
        entity.setId(id);
        entity.setOrganization(organization);
        entity.setEmail(email);
        entity.setExpiresAt(expiresAt);
        entity.setStatus(OrganizationInvitationStatus.PENDING);
        return entity;
    }
}
