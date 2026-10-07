package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationClaimEntity;
import io.github.susimsek.kitezh.domain.OrganizationDomainEntity;
import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.OrganizationGroupEntity;
import io.github.susimsek.kitezh.domain.OrganizationGroupMemberEntity;
import io.github.susimsek.kitezh.domain.OrganizationIdentityProviderEntity;
import io.github.susimsek.kitezh.domain.OrganizationInvitationEntity;
import io.github.susimsek.kitezh.domain.OrganizationMemberEntity;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationClaimRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationClaimRepository;
import io.github.susimsek.kitezh.repository.OrganizationDomainRepository;
import io.github.susimsek.kitezh.repository.OrganizationGroupMemberRepository;
import io.github.susimsek.kitezh.repository.OrganizationGroupRepository;
import io.github.susimsek.kitezh.repository.OrganizationIdentityProviderRepository;
import io.github.susimsek.kitezh.repository.OrganizationInvitationRepository;
import io.github.susimsek.kitezh.repository.OrganizationMemberRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationMemberRepository memberRepository;
    @Mock private OrganizationDomainRepository domainRepository;
    @Mock private OrganizationInvitationRepository invitationRepository;
    @Mock private OrganizationGroupRepository groupRepository;
    @Mock private OrganizationGroupMemberRepository groupMemberRepository;
    @Mock private OrganizationClaimRepository claimRepository;
    @Mock private OrganizationIdentityProviderRepository providerRepository;
    @Mock private SocialProviderRepository socialProviderRepository;
    @Mock private UserRepository userRepository;
    @Mock private AdminAuditEventService auditEventService;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;
    @InjectMocks private AdminOrganizationService service;

    @Test
    void rejectsDuplicateOrganizationAlias() {
        when(organizationRepository.existsByAliasIgnoreCase("acme")).thenReturn(true);

        assertThatThrownBy(
                        () ->
                                service.create(
                                        new AdminOrganizationRequestDTO(
                                                "acme", "Acme", null, null, true)))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_DUPLICATE_ALIAS);
    }

    @Test
    void addsUserAsOrganizationMember() {
        OrganizationEntity organization = new OrganizationEntity();
        organization.setId(10L);
        UserEntity user = new UserEntity();
        user.setId(20L);
        user.setUsername("alice");
        user.setEmail("alice@example.com");
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));
        when(memberRepository.existsByOrganizationIdAndUserId(10L, 20L)).thenReturn(false);
        when(userRepository.findById(20L)).thenReturn(Optional.of(user));
        when(memberRepository.save(any(OrganizationMemberEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationMemberEntity member = invocation.getArgument(0);
                            member.setId(30L);
                            return member;
                        });

        var result = service.addMember(10L, new AdminOrganizationMemberRequestDTO(20L, "admin"));

        assertThat(result.userId()).isEqualTo(20L);
        assertThat(result.username()).isEqualTo("alice");
        assertThat(result.role()).isEqualTo("ADMIN");
        verify(auditEventService).record("organization.member.added", "organization", "10");
    }

    @Test
    void rejectsInvalidOrganizationDomain() {
        OrganizationEntity organization = new OrganizationEntity();
        organization.setId(10L);
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));

        assertThatThrownBy(
                        () ->
                                service.addDomain(
                                        10L,
                                        new AdminOrganizationDomainRequestDTO(
                                                "https://example.com")))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_INVALID_DOMAIN);
    }

    @Test
    void findsCreatesAndUpdatesOrganizations() {
        PageRequest pageable = PageRequest.of(0, 20);
        OrganizationEntity organization = organization(10L, "acme");
        stubOrganizationView(organization);
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));
        when(organizationRepository.search("", pageable))
                .thenReturn(new PageImpl<>(List.of(organization), pageable, 1));

        assertThat(service.findAll(null, pageable).getContent().getFirst().alias())
                .isEqualTo("acme");
        assertThat(service.findById(10L).name()).isEqualTo("Acme");

        when(organizationRepository.existsByAliasIgnoreCase("new-acme")).thenReturn(false);
        when(organizationRepository.save(any(OrganizationEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationEntity saved = invocation.getArgument(0);
                            saved.setId(11L);
                            return saved;
                        });
        stubOrganizationView(organization(11L, "new-acme"));
        var created =
                service.create(
                        new AdminOrganizationRequestDTO(
                                " New-Acme ", "New Acme", " Display ", " Description ", null));

        assertThat(created.alias()).isEqualTo("new-acme");
        verify(auditEventService).record("organization.created", "organization", "11");
    }

    @Test
    void updatesAndDeletesOrganizationMembers() {
        OrganizationEntity organization = organization(10L, "acme");
        UserEntity user = user(20L, "alice", "alice@example.com");
        OrganizationMemberEntity membership = new OrganizationMemberEntity();
        membership.setUser(user);
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));
        when(memberRepository.findByOrganizationId(10L)).thenReturn(List.of(membership));
        stubOrganizationView(organization);

        var updated =
                service.update(
                        10L, new AdminOrganizationRequestDTO("new-acme", "Updated", "", "", false));

        assertThat(updated.alias()).isEqualTo("new-acme");
        assertThat(organization.getDisplayName()).isNull();
        verify(userAccessInvalidationService).invalidate("alice");
        verify(auditEventService).record("organization.updated", "organization", "10");

        service.delete(10L);

        verify(organizationRepository).delete(organization);
        verify(auditEventService).record("organization.deleted", "organization", "10");
    }

    @Test
    void handlesOrganizationMemberLifecycle() {
        OrganizationEntity organization = organization(10L, "acme");
        UserEntity user = user(20L, "alice", "alice@example.com");
        OrganizationMemberEntity membership = new OrganizationMemberEntity();
        membership.setId(30L);
        membership.setOrganization(organization);
        membership.setUser(user);
        membership.setRole("ADMIN");
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));
        when(memberRepository.findByOrganizationIdAndUserId(10L, 20L))
                .thenReturn(Optional.of(membership));
        when(memberRepository.findByOrganizationIdAndUserUsernameContainingIgnoreCase(
                        10L, "alice", PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(membership)));

        assertThat(service.members(10L, " alice ", PageRequest.of(0, 20))).hasSize(1);
        assertThat(
                        service.updateMember(
                                        10L, 20L, new AdminOrganizationMemberRequestDTO(20L, null))
                                .role())
                .isEqualTo("MEMBER");
        service.removeMember(10L, 20L);

        verify(memberRepository).delete(membership);
        verify(auditEventService).record("organization.member.updated", "organization", "10");
        verify(auditEventService).record("organization.member.removed", "organization", "10");
    }

    @Test
    void handlesDomainLifecycle() {
        OrganizationEntity organization = organization(10L, "acme");
        OrganizationDomainEntity domain = new OrganizationDomainEntity();
        domain.setId(40L);
        domain.setOrganization(organization);
        domain.setDomain("acme.example.com");
        domain.setVerificationToken("token");
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));
        when(domainRepository.findByOrganizationIdOrderByDomainAsc(10L))
                .thenReturn(List.of(domain));
        when(domainRepository.findByIdAndOrganizationId(40L, 10L)).thenReturn(Optional.of(domain));
        when(domainRepository.existsByDomainIgnoreCase("other.example.com")).thenReturn(false);
        when(domainRepository.save(any(OrganizationDomainEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationDomainEntity saved = invocation.getArgument(0);
                            saved.setId(41L);
                            return saved;
                        });

        assertThat(service.domains(10L)).hasSize(1);
        assertThat(
                        service.addDomain(
                                        10L,
                                        new AdminOrganizationDomainRequestDTO(
                                                " Other.Example.com "))
                                .domain())
                .isEqualTo("other.example.com");
        assertThat(service.verifyDomain(10L, 40L).verified()).isTrue();
        service.removeDomain(10L, 40L);

        verify(domainRepository).delete(domain);
        verify(auditEventService).record("organization.domain.verified", "organization", "10");
    }

    @Test
    void handlesInvitationLifecycle() {
        OrganizationEntity organization = organization(10L, "acme");
        OrganizationInvitationEntity invitation = new OrganizationInvitationEntity();
        invitation.setId(50L);
        invitation.setOrganization(organization);
        invitation.setExpiresAt(Instant.now().plusSeconds(3600));
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));
        when(invitationRepository.save(any(OrganizationInvitationEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationInvitationEntity saved = invocation.getArgument(0);
                            saved.setId(50L);
                            invitation.setEmail(saved.getEmail());
                            invitation.setRole(saved.getRole());
                            invitation.setTokenHash(saved.getTokenHash());
                            invitation.setExpiresAt(saved.getExpiresAt());
                            return saved;
                        });
        when(invitationRepository.findByOrganizationIdOrderByCreatedAtDesc(
                        10L, PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(invitation)));
        when(invitationRepository.findById(50L)).thenReturn(Optional.of(invitation));

        var created =
                service.createInvitation(
                        10L,
                        new AdminOrganizationInvitationRequestDTO(
                                " Alice@Example.com ", null, null));
        assertThat(created.email()).isEqualTo("alice@example.com");
        assertThat(created.token()).isNotBlank();
        assertThat(service.invitations(10L, PageRequest.of(0, 20))).hasSize(1);
        service.revokeInvitation(10L, 50L);

        invitation.setRevokedAt(null);
        UserEntity user = user(20L, "alice", "alice@example.com");
        when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(invitation));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(memberRepository.findByOrganizationIdAndUserId(10L, 20L)).thenReturn(Optional.empty());
        when(memberRepository.save(any(OrganizationMemberEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationMemberEntity saved = invocation.getArgument(0);
                            saved.setId(60L);
                            return saved;
                        });
        assertThat(service.acceptInvitation("token", "alice").userId()).isEqualTo(20L);
        verify(auditEventService)
                .record("organization.invitation.accepted", "organization-invitation", "50");
    }

    @Test
    void handlesOrganizationGroupLifecycle() {
        OrganizationEntity organization = organization(10L, "acme");
        OrganizationGroupEntity group = new OrganizationGroupEntity();
        group.setId(60L);
        group.setOrganization(organization);
        group.setName("engineering");
        OrganizationGroupEntity parent = new OrganizationGroupEntity();
        parent.setId(61L);
        parent.setOrganization(organization);
        parent.setName("company");
        UserEntity user = user(20L, "alice", "alice@example.com");
        OrganizationGroupMemberEntity groupMember = new OrganizationGroupMemberEntity();
        groupMember.setGroup(group);
        groupMember.setUser(user);
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));
        when(groupRepository.existsByOrganizationIdAndNameIgnoreCase(10L, "engineering"))
                .thenReturn(false);
        when(groupRepository.save(any(OrganizationGroupEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationGroupEntity saved = invocation.getArgument(0);
                            saved.setId(60L);
                            return saved;
                        });
        when(groupRepository.findByOrganizationIdAndNameContainingIgnoreCase(
                        10L, "eng", PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(group)));
        when(groupRepository.findByIdAndOrganizationId(60L, 10L)).thenReturn(Optional.of(group));
        when(groupRepository.findByIdAndOrganizationId(61L, 10L)).thenReturn(Optional.of(parent));
        when(groupRepository.existsByOrganizationIdAndParentId(10L, 60L)).thenReturn(false);
        when(groupMemberRepository.countByGroupId(60L)).thenReturn(1L);
        when(groupMemberRepository.findByGroupIdAndUserUsernameContainingIgnoreCase(
                        60L, "alice", PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(groupMember)));
        when(groupMemberRepository.findByGroupIdAndUserId(60L, 20L))
                .thenReturn(Optional.empty(), Optional.of(groupMember));
        when(groupMemberRepository.findAvailableUsers(10L, 60L, "", PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(user)));
        when(userRepository.findById(20L)).thenReturn(Optional.of(user));
        when(memberRepository.existsByOrganizationIdAndUserId(10L, 20L)).thenReturn(true);
        assertThat(
                        service.createGroup(
                                        10L,
                                        new AdminOrganizationGroupRequestDTO(" engineering ", null))
                                .name())
                .isEqualTo("engineering");
        assertThat(service.groups(10L, " eng ", PageRequest.of(0, 20))).hasSize(1);
        assertThat(
                        service.updateGroup(
                                        10L,
                                        60L,
                                        new AdminOrganizationGroupRequestDTO("Engineering", 61L))
                                .parentId())
                .isEqualTo(61L);
        assertThat(service.groupMembers(10L, 60L, "alice", PageRequest.of(0, 20))).hasSize(1);
        assertThat(service.availableGroupMembers(10L, 60L, null, PageRequest.of(0, 20))).hasSize(1);
        service.addGroupMember(10L, 60L, 20L);
        service.removeGroupMember(10L, 60L, 20L);
        service.deleteGroup(10L, 60L);

        verify(groupRepository).delete(group);
        verify(auditEventService).record("organization.group.created", "organization-group", "60");
    }

    @Test
    void handlesClaimsAndIdentityProviders() {
        OrganizationEntity organization = organization(10L, "acme");
        OrganizationClaimEntity claim = new OrganizationClaimEntity();
        claim.setId(70L);
        claim.setOrganization(organization);
        claim.setClaimName("organization");
        claim.setClaimValue("acme");
        claim.setAddToUserInfo(true);
        SocialProviderEntity provider = new SocialProviderEntity();
        provider.setAlias("google");
        provider.setProviderType("oidc");
        provider.setDisplayName("Google");
        provider.setEnabled(true);
        OrganizationIdentityProviderEntity link = new OrganizationIdentityProviderEntity();
        link.setOrganization(organization);
        link.setProviderAlias("google");
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));
        when(claimRepository.findByOrganizationIdOrderByClaimNameAsc(10L))
                .thenReturn(List.of(claim));
        when(claimRepository.existsByOrganizationIdAndClaimNameIgnoreCase(10L, "organization"))
                .thenReturn(false);
        when(claimRepository.save(any(OrganizationClaimEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationClaimEntity saved = invocation.getArgument(0);
                            saved.setId(70L);
                            return saved;
                        });
        when(claimRepository.findByIdAndOrganizationId(70L, 10L)).thenReturn(Optional.of(claim));
        when(memberRepository.findByOrganizationId(10L)).thenReturn(List.of());
        when(providerRepository.findByOrganizationIdOrderByProviderAliasAsc(10L))
                .thenReturn(List.of(link));
        when(socialProviderRepository.findByAliasIgnoreCase("google"))
                .thenReturn(Optional.of(provider));
        when(providerRepository.findByOrganizationIdAndProviderAliasIgnoreCase(10L, "google"))
                .thenReturn(Optional.empty());
        when(providerRepository.findByOrganizationIdAndProviderAliasIgnoreCase(10L, "github"))
                .thenReturn(Optional.of(link));

        assertThat(service.claims(10L)).hasSize(1);
        assertThat(
                        service.createClaim(
                                        10L,
                                        new AdminOrganizationClaimRequestDTO(
                                                " organization ", " acme ", null, null, true))
                                .claimName())
                .isEqualTo("organization");
        assertThat(
                        service.updateClaim(
                                        10L,
                                        70L,
                                        new AdminOrganizationClaimRequestDTO(
                                                "updated", "value", false, true, false))
                                .claimValue())
                .isEqualTo("value");
        service.deleteClaim(10L, 70L);
        assertThat(service.identityProviders(10L).getFirst().providerAlias()).isEqualTo("google");
        assertThat(service.addIdentityProvider(10L, " google ").providerType()).isEqualTo("oidc");
        service.removeIdentityProvider(10L, "github");

        verify(claimRepository).delete(claim);
        verify(providerRepository).delete(link);
    }

    @Test
    void rejectsDuplicateOrganizationMutations() {
        OrganizationEntity organization = organization(10L, "acme");
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));
        when(organizationRepository.existsByAliasIgnoreCase("other")).thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service.update(
                                        10L,
                                        new AdminOrganizationRequestDTO(
                                                "other", "Acme", null, null, true)))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_DUPLICATE_ALIAS);

        when(memberRepository.existsByOrganizationIdAndUserId(10L, 20L)).thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service.addMember(
                                        10L, new AdminOrganizationMemberRequestDTO(20L, "member")))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_MEMBER_EXISTS);

        when(domainRepository.existsByDomainIgnoreCase("acme.example.com")).thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service.addDomain(
                                        10L,
                                        new AdminOrganizationDomainRequestDTO("acme.example.com")))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_DUPLICATE_DOMAIN);

        when(claimRepository.existsByOrganizationIdAndClaimNameIgnoreCase(10L, "organization"))
                .thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service.createClaim(
                                        10L,
                                        new AdminOrganizationClaimRequestDTO(
                                                "organization", "acme", null, null, null)))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_CLAIM_DUPLICATE);

        SocialProviderEntity provider = new SocialProviderEntity();
        provider.setAlias("google");
        when(socialProviderRepository.findByAliasIgnoreCase("google"))
                .thenReturn(Optional.of(provider));
        when(providerRepository.findByOrganizationIdAndProviderAliasIgnoreCase(10L, "google"))
                .thenReturn(Optional.of(new OrganizationIdentityProviderEntity()));
        assertThatThrownBy(() -> service.addIdentityProvider(10L, "google"))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_PROVIDER_EXISTS);
    }

    @Test
    void rejectsInvalidInvitationStates() {
        OrganizationEntity organization = organization(10L, "acme");
        OrganizationInvitationEntity invitation = new OrganizationInvitationEntity();
        invitation.setId(50L);
        invitation.setOrganization(organization);
        invitation.setExpiresAt(Instant.now().plusSeconds(3600));
        invitation.setRevokedAt(Instant.now());
        when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(invitation));

        assertThatThrownBy(() -> service.acceptInvitation("token", "alice"))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_INVITATION_USED);

        invitation.setRevokedAt(null);
        invitation.setExpiresAt(Instant.now().minusSeconds(1));
        assertThatThrownBy(() -> service.acceptInvitation("token", "alice"))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_INVITATION_EXPIRED);

        invitation.setExpiresAt(Instant.now().plusSeconds(3600));
        UserEntity user = user(20L, "alice", "wrong@example.com");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        invitation.setEmail("alice@example.com");
        assertThatThrownBy(() -> service.acceptInvitation("token", "alice"))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_INVITATION_EMAIL_MISMATCH);
    }

    @Test
    void rejectsInvalidOrganizationGroupMutations() {
        OrganizationEntity organization = organization(10L, "acme");
        OrganizationGroupEntity group = new OrganizationGroupEntity();
        group.setId(60L);
        group.setOrganization(organization);
        group.setName("engineering");
        UserEntity user = user(20L, "alice", "alice@example.com");
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));
        when(groupRepository.findByIdAndOrganizationId(60L, 10L)).thenReturn(Optional.of(group));
        when(groupRepository.existsByOrganizationIdAndNameIgnoreCase(10L, "engineering"))
                .thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service.createGroup(
                                        10L,
                                        new AdminOrganizationGroupRequestDTO("engineering", null)))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_GROUP_DUPLICATE);

        when(groupRepository.existsByOrganizationIdAndNameIgnoreCase(10L, "platform"))
                .thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service.updateGroup(
                                        10L,
                                        60L,
                                        new AdminOrganizationGroupRequestDTO("platform", null)))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_GROUP_DUPLICATE);

        assertThatThrownBy(
                        () ->
                                service.updateGroup(
                                        10L,
                                        60L,
                                        new AdminOrganizationGroupRequestDTO("engineering", 60L)))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_GROUP_INVALID_PARENT);

        when(groupRepository.existsByOrganizationIdAndParentId(10L, 60L)).thenReturn(true);
        assertThatThrownBy(() -> service.deleteGroup(10L, 60L))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_GROUP_HAS_CHILDREN);

        when(userRepository.findById(20L)).thenReturn(Optional.of(user));
        when(memberRepository.existsByOrganizationIdAndUserId(10L, 20L)).thenReturn(false);
        assertThatThrownBy(() -> service.addGroupMember(10L, 60L, 20L))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_MEMBER_REQUIRED);

        when(memberRepository.existsByOrganizationIdAndUserId(10L, 20L)).thenReturn(true);
        when(groupMemberRepository.findByGroupIdAndUserId(60L, 20L))
                .thenReturn(Optional.of(new OrganizationGroupMemberEntity()));
        assertThatThrownBy(() -> service.addGroupMember(10L, 60L, 20L))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_GROUP_MEMBER_EXISTS);
    }

    private static OrganizationEntity organization(Long id, String alias) {
        OrganizationEntity organization = new OrganizationEntity();
        organization.setId(id);
        organization.setAlias(alias);
        organization.setName("Acme");
        organization.setEnabled(true);
        return organization;
    }

    private static UserEntity user(Long id, String username, String email) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(email);
        return user;
    }

    private void stubOrganizationView(OrganizationEntity organization) {
        when(memberRepository.countByOrganizationId(organization.getId())).thenReturn(1L);
        when(domainRepository.countByOrganizationId(organization.getId())).thenReturn(1L);
        when(groupRepository.countByOrganizationId(organization.getId())).thenReturn(1L);
        when(claimRepository.findByOrganizationIdOrderByClaimNameAsc(organization.getId()))
                .thenReturn(List.of());
        when(providerRepository.findByOrganizationIdOrderByProviderAliasAsc(organization.getId()))
                .thenReturn(List.of());
    }
}
