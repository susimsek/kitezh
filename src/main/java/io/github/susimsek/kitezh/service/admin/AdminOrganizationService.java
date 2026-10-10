package io.github.susimsek.kitezh.service.admin;

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
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationClaimDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationClaimRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationIdentityProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberDTO;
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
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Administration operations for the Keycloak-style organization model. */
@Service
@RequiredArgsConstructor
public class AdminOrganizationService {

    private static final String ORGANIZATION_TARGET = "organization";
    private static final String GROUP_TARGET = "organization-group";
    private static final String INVITATION_TARGET = "organization-invitation";

    private final OrganizationRepository organizationRepository;
    private final OrganizationMemberRepository memberRepository;
    private final OrganizationDomainRepository domainRepository;
    private final OrganizationInvitationRepository invitationRepository;
    private final OrganizationGroupRepository groupRepository;
    private final OrganizationGroupMemberRepository groupMemberRepository;
    private final OrganizationClaimRepository claimRepository;
    private final OrganizationIdentityProviderRepository providerRepository;
    private final SocialProviderRepository socialProviderRepository;
    private final UserRepository userRepository;
    private final AdminAuditEventService auditEventService;
    private final UserAccessInvalidationService userAccessInvalidationService;

    @Transactional(readOnly = true)
    public Page<AdminOrganizationDTO> findAll(String query, Pageable pageable) {
        return organizationRepository
                .search(normalize(query), pageable)
                .map(this::organizationView);
    }

    @Transactional(readOnly = true)
    public AdminOrganizationDTO findById(Long id) {
        return organizationView(organization(id));
    }

    @Transactional
    public AdminOrganizationDTO create(AdminOrganizationRequestDTO request) {
        String alias = normalizeAlias(request.alias());
        if (organizationRepository.existsByAliasIgnoreCase(alias)) {
            throw ApiException.conflict(
                    "alias",
                    ApiErrorCode.ORGANIZATION_DUPLICATE_ALIAS,
                    "Organization alias is already registered");
        }
        OrganizationEntity entity = new OrganizationEntity();
        entity.setAlias(alias);
        apply(request, entity);
        OrganizationEntity saved = organizationRepository.save(entity);
        auditEventService.record(
                "organization.created", ORGANIZATION_TARGET, saved.getId().toString());
        return organizationView(saved);
    }

    @Transactional
    public AdminOrganizationDTO update(Long id, AdminOrganizationRequestDTO request) {
        OrganizationEntity entity = organization(id);
        String alias = normalizeAlias(request.alias());
        if (!entity.getAlias().equalsIgnoreCase(alias)
                && organizationRepository.existsByAliasIgnoreCase(alias)) {
            throw ApiException.conflict(
                    "alias",
                    ApiErrorCode.ORGANIZATION_DUPLICATE_ALIAS,
                    "Organization alias is already registered");
        }
        entity.setAlias(alias);
        apply(request, entity);
        invalidateOrganizationMembers(id);
        auditEventService.record("organization.updated", ORGANIZATION_TARGET, id.toString());
        return organizationView(entity);
    }

    @Transactional
    public void delete(Long id) {
        OrganizationEntity entity = organization(id);
        invalidateOrganizationMembers(id);
        organizationRepository.delete(entity);
        auditEventService.record("organization.deleted", ORGANIZATION_TARGET, id.toString());
    }

    @Transactional(readOnly = true)
    public Page<AdminOrganizationMemberDTO> members(Long id, String query, Pageable pageable) {
        organization(id);
        return memberRepository
                .findByOrganizationIdAndUserUsernameContainingIgnoreCase(
                        id, normalize(query), pageable)
                .map(this::memberView);
    }

    @Transactional
    public AdminOrganizationMemberDTO addMember(
            Long id, AdminOrganizationMemberRequestDTO request) {
        OrganizationEntity organization = organization(id);
        if (memberRepository.existsByOrganizationIdAndUserId(id, request.userId())) {
            throw ApiException.conflict(
                    ApiErrorCode.ORGANIZATION_MEMBER_EXISTS,
                    "The user is already an organization member");
        }
        UserEntity user = user(request.userId());
        OrganizationMemberEntity member = new OrganizationMemberEntity();
        member.setOrganization(organization);
        member.setUser(user);
        member.setRole(request.roleValue());
        OrganizationMemberEntity saved = memberRepository.save(member);
        invalidateUser(user);
        auditEventService.record("organization.member.added", ORGANIZATION_TARGET, id.toString());
        return memberView(saved);
    }

    @Transactional
    public AdminOrganizationMemberDTO updateMember(
            Long id, Long userId, AdminOrganizationMemberRequestDTO request) {
        OrganizationMemberEntity member = member(id, userId);
        member.setRole(request.roleValue());
        invalidateUser(member.getUser());
        auditEventService.record("organization.member.updated", ORGANIZATION_TARGET, id.toString());
        return memberView(member);
    }

    @Transactional
    public void removeMember(Long id, Long userId) {
        OrganizationMemberEntity member = member(id, userId);
        invalidateUser(member.getUser());
        memberRepository.delete(member);
        auditEventService.record("organization.member.removed", ORGANIZATION_TARGET, id.toString());
    }

    @Transactional(readOnly = true)
    public List<AdminOrganizationDomainDTO> domains(Long id) {
        organization(id);
        return domainRepository.findByOrganizationIdOrderByDomainAsc(id).stream()
                .map(this::domainView)
                .toList();
    }

    @Transactional
    public AdminOrganizationDomainDTO addDomain(
            Long id, AdminOrganizationDomainRequestDTO request) {
        OrganizationEntity organization = organization(id);
        String domain = normalizeDomain(request.domain());
        if (domainRepository.existsByDomainIgnoreCase(domain)) {
            throw ApiException.conflict(
                    "domain",
                    ApiErrorCode.ORGANIZATION_DUPLICATE_DOMAIN,
                    "Domain is already registered");
        }
        OrganizationDomainEntity entity = new OrganizationDomainEntity();
        entity.setOrganization(organization);
        entity.setDomain(domain);
        entity.setVerificationToken(randomToken());
        OrganizationDomainEntity saved = domainRepository.save(entity);
        auditEventService.record("organization.domain.added", ORGANIZATION_TARGET, id.toString());
        return domainView(saved);
    }

    @Transactional
    public AdminOrganizationDomainDTO verifyDomain(Long id, Long domainId) {
        OrganizationDomainEntity domain = domain(id, domainId);
        domain.setVerified(true);
        domain.setVerifiedAt(Instant.now());
        auditEventService.record(
                "organization.domain.verified", ORGANIZATION_TARGET, id.toString());
        return domainView(domain);
    }

    @Transactional
    public void removeDomain(Long id, Long domainId) {
        domainRepository.delete(domain(id, domainId));
        auditEventService.record("organization.domain.removed", ORGANIZATION_TARGET, id.toString());
    }

    @Transactional(readOnly = true)
    public Page<AdminOrganizationInvitationDTO> invitations(Long id, Pageable pageable) {
        organization(id);
        return invitationRepository
                .findByOrganizationIdOrderByCreatedAtDesc(id, pageable)
                .map(invitation -> invitationView(invitation, null));
    }

    @Transactional
    public AdminOrganizationInvitationDTO createInvitation(
            Long id, AdminOrganizationInvitationRequestDTO request) {
        OrganizationEntity organization = organization(id);
        String token = randomToken();
        OrganizationInvitationEntity invitation = new OrganizationInvitationEntity();
        invitation.setOrganization(organization);
        invitation.setEmail(request.email().trim().toLowerCase(Locale.ROOT));
        invitation.setRole(request.roleValue());
        invitation.setTokenHash(hash(token));
        invitation.setExpiresAt(
                request.expiresAt() == null
                        ? Instant.now().plus(7, ChronoUnit.DAYS)
                        : request.expiresAt());
        OrganizationInvitationEntity saved = invitationRepository.save(invitation);
        auditEventService.record(
                "organization.invitation.created", INVITATION_TARGET, saved.getId().toString());
        return invitationView(saved, token);
    }

    @Transactional
    public void revokeInvitation(Long id, Long invitationId) {
        OrganizationInvitationEntity invitation = invitation(id, invitationId);
        invitation.setRevokedAt(Instant.now());
        auditEventService.record(
                "organization.invitation.revoked", INVITATION_TARGET, invitationId.toString());
    }

    @Transactional
    public AdminOrganizationMemberDTO acceptInvitation(String token, String username) {
        OrganizationInvitationEntity invitation =
                invitationRepository
                        .findByTokenHash(hash(token))
                        .orElseThrow(
                                () -> ApiException.notFound("Organization invitation not found"));
        if (invitation.getRevokedAt() != null || invitation.getAcceptedAt() != null) {
            throw ApiException.badRequest(
                    ApiErrorCode.ORGANIZATION_INVITATION_USED, "Invitation is no longer available");
        }
        if (invitation.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest(
                    ApiErrorCode.ORGANIZATION_INVITATION_EXPIRED, "Invitation has expired");
        }
        UserEntity user =
                userRepository
                        .findByUsername(username)
                        .orElseThrow(() -> ApiException.notFound("User not found"));
        if (user.getEmail() == null || !user.getEmail().equalsIgnoreCase(invitation.getEmail())) {
            throw ApiException.forbidden(
                    ApiErrorCode.ORGANIZATION_INVITATION_EMAIL_MISMATCH,
                    "Invitation email does not match the authenticated user");
        }
        OrganizationMemberEntity member =
                memberRepository
                        .findByOrganizationIdAndUserId(
                                invitation.getOrganization().getId(), user.getId())
                        .orElseGet(
                                () -> {
                                    OrganizationMemberEntity created =
                                            new OrganizationMemberEntity();
                                    created.setOrganization(invitation.getOrganization());
                                    created.setUser(user);
                                    return created;
                                });
        member.setRole(invitation.getRole());
        invitation.setAcceptedAt(Instant.now());
        OrganizationMemberEntity saved = memberRepository.save(member);
        invalidateUser(user);
        auditEventService.record(
                "organization.invitation.accepted",
                INVITATION_TARGET,
                invitation.getId().toString());
        return memberView(saved);
    }

    @Transactional(readOnly = true)
    public Page<AdminOrganizationGroupDTO> groups(Long id, String query, Pageable pageable) {
        organization(id);
        return groupRepository
                .findByOrganizationIdAndNameContainingIgnoreCase(id, normalize(query), pageable)
                .map(this::groupView);
    }

    @Transactional
    public AdminOrganizationGroupDTO createGroup(
            Long id, AdminOrganizationGroupRequestDTO request) {
        OrganizationEntity organization = organization(id);
        if (groupRepository.existsByOrganizationIdAndNameIgnoreCase(id, request.name().trim())) {
            throw ApiException.conflict(
                    "name",
                    ApiErrorCode.ORGANIZATION_GROUP_DUPLICATE,
                    "Organization group already exists");
        }
        OrganizationGroupEntity group = new OrganizationGroupEntity();
        group.setOrganization(organization);
        group.setName(request.name().trim());
        group.setParent(resolveParent(id, request.parentId(), null));
        OrganizationGroupEntity saved = groupRepository.save(group);
        auditEventService.record(
                "organization.group.created", GROUP_TARGET, saved.getId().toString());
        return groupView(saved);
    }

    @Transactional
    public AdminOrganizationGroupDTO updateGroup(
            Long id, Long groupId, AdminOrganizationGroupRequestDTO request) {
        OrganizationGroupEntity group = group(id, groupId);
        String name = request.name().trim();
        if (!group.getName().equalsIgnoreCase(name)
                && groupRepository.existsByOrganizationIdAndNameIgnoreCase(id, name)) {
            throw ApiException.conflict(
                    "name",
                    ApiErrorCode.ORGANIZATION_GROUP_DUPLICATE,
                    "Organization group already exists");
        }
        group.setName(name);
        group.setParent(resolveParent(id, request.parentId(), group));
        auditEventService.record("organization.group.updated", GROUP_TARGET, groupId.toString());
        return groupView(group);
    }

    @Transactional
    public void deleteGroup(Long id, Long groupId) {
        OrganizationGroupEntity group = group(id, groupId);
        if (groupRepository.existsByOrganizationIdAndParentId(id, groupId)) {
            throw ApiException.badRequest(
                    ApiErrorCode.ORGANIZATION_GROUP_HAS_CHILDREN, "Delete child groups first");
        }
        groupRepository.delete(group);
        auditEventService.record("organization.group.deleted", GROUP_TARGET, groupId.toString());
    }

    @Transactional(readOnly = true)
    public Page<AdminOrganizationMemberDTO> groupMembers(
            Long id, Long groupId, String query, Pageable pageable) {
        group(id, groupId);
        return groupMemberRepository
                .findByGroupIdAndUserUsernameContainingIgnoreCase(
                        groupId, normalize(query), pageable)
                .map(member -> memberView(member.getUser()));
    }

    @Transactional
    public void addGroupMember(Long id, Long groupId, Long userId) {
        OrganizationGroupEntity group = group(id, groupId);
        if (!memberRepository.existsByOrganizationIdAndUserId(id, userId)) {
            throw ApiException.badRequest(
                    ApiErrorCode.ORGANIZATION_MEMBER_REQUIRED,
                    "The user must belong to the organization first");
        }
        if (groupMemberRepository.findByGroupIdAndUserId(groupId, userId).isPresent()) {
            throw ApiException.conflict(
                    ApiErrorCode.ORGANIZATION_GROUP_MEMBER_EXISTS,
                    "The user is already in the organization group");
        }
        UserEntity user = user(userId);
        OrganizationGroupMemberEntity membership = new OrganizationGroupMemberEntity();
        membership.setGroup(group);
        membership.setUser(user);
        groupMemberRepository.save(membership);
        invalidateUser(user);
        auditEventService.record(
                "organization.group.member.added", GROUP_TARGET, groupId.toString());
    }

    @Transactional
    public void removeGroupMember(Long id, Long groupId, Long userId) {
        group(id, groupId);
        OrganizationGroupMemberEntity membership =
                groupMemberRepository
                        .findByGroupIdAndUserId(groupId, userId)
                        .orElseThrow(
                                () -> ApiException.notFound("Organization group member not found"));
        groupMemberRepository.delete(membership);
        invalidateUser(membership.getUser());
        auditEventService.record(
                "organization.group.member.removed", GROUP_TARGET, groupId.toString());
    }

    @Transactional(readOnly = true)
    public Page<AdminOrganizationMemberDTO> availableGroupMembers(
            Long id, Long groupId, String query, Pageable pageable) {
        group(id, groupId);
        return groupMemberRepository
                .findAvailableUsers(id, groupId, normalize(query), pageable)
                .map(this::memberView);
    }

    @Transactional(readOnly = true)
    public List<AdminOrganizationClaimDTO> claims(Long id) {
        organization(id);
        return claimRepository.findByOrganizationIdOrderByClaimNameAsc(id).stream()
                .map(this::claimView)
                .toList();
    }

    @Transactional
    public AdminOrganizationClaimDTO createClaim(
            Long id, AdminOrganizationClaimRequestDTO request) {
        OrganizationEntity organization = organization(id);
        String name = request.claimName().trim();
        if (claimRepository.existsByOrganizationIdAndClaimNameIgnoreCase(id, name)) {
            throw ApiException.conflict(
                    "claimName",
                    ApiErrorCode.ORGANIZATION_CLAIM_DUPLICATE,
                    "Organization claim already exists");
        }
        OrganizationClaimEntity claim = new OrganizationClaimEntity();
        claim.setOrganization(organization);
        apply(request, claim);
        OrganizationClaimEntity saved = claimRepository.save(claim);
        invalidateOrganizationMembers(id);
        auditEventService.record("organization.claim.created", ORGANIZATION_TARGET, id.toString());
        return claimView(saved);
    }

    @Transactional
    public AdminOrganizationClaimDTO updateClaim(
            Long id, Long claimId, AdminOrganizationClaimRequestDTO request) {
        OrganizationClaimEntity claim = claim(id, claimId);
        apply(request, claim);
        invalidateOrganizationMembers(id);
        auditEventService.record("organization.claim.updated", ORGANIZATION_TARGET, id.toString());
        return claimView(claim);
    }

    @Transactional
    public void deleteClaim(Long id, Long claimId) {
        claimRepository.delete(claim(id, claimId));
        invalidateOrganizationMembers(id);
        auditEventService.record("organization.claim.deleted", ORGANIZATION_TARGET, id.toString());
    }

    @Transactional(readOnly = true)
    public List<AdminOrganizationIdentityProviderDTO> identityProviders(Long id) {
        organization(id);
        return providerRepository.findByOrganizationIdOrderByProviderAliasAsc(id).stream()
                .map(link -> providerView(link.getProviderAlias()))
                .toList();
    }

    @Transactional
    public AdminOrganizationIdentityProviderDTO addIdentityProvider(Long id, String providerAlias) {
        OrganizationEntity organization = organization(id);
        String alias = providerAlias.trim();
        SocialProviderEntity provider =
                socialProviderRepository
                        .findByAliasIgnoreCase(alias)
                        .orElseThrow(() -> ApiException.notFound("Identity provider not found"));
        if (providerRepository
                .findByOrganizationIdAndProviderAliasIgnoreCase(id, alias)
                .isPresent()) {
            throw ApiException.conflict(
                    ApiErrorCode.ORGANIZATION_PROVIDER_EXISTS,
                    "Identity provider is already linked");
        }
        OrganizationIdentityProviderEntity link = new OrganizationIdentityProviderEntity();
        link.setOrganization(organization);
        link.setProviderAlias(provider.getAlias());
        providerRepository.save(link);
        auditEventService.record(
                "organization.identity-provider.added", ORGANIZATION_TARGET, id.toString());
        return providerView(provider);
    }

    @Transactional
    public void removeIdentityProvider(Long id, String providerAlias) {
        OrganizationIdentityProviderEntity link =
                providerRepository
                        .findByOrganizationIdAndProviderAliasIgnoreCase(id, providerAlias.trim())
                        .orElseThrow(
                                () ->
                                        ApiException.notFound(
                                                "Organization identity provider not found"));
        providerRepository.delete(link);
        auditEventService.record(
                "organization.identity-provider.removed", ORGANIZATION_TARGET, id.toString());
    }

    private void apply(AdminOrganizationRequestDTO request, OrganizationEntity entity) {
        entity.setName(request.name().trim());
        entity.setDisplayName(blankToNull(request.displayName()));
        entity.setDescription(blankToNull(request.description()));
        entity.setEnabled(request.enabledValue());
    }

    private void apply(AdminOrganizationClaimRequestDTO request, OrganizationClaimEntity entity) {
        entity.setClaimName(request.claimName().trim());
        entity.setClaimValue(request.claimValue().trim());
        entity.setAddToAccessToken(request.addToAccessTokenValue());
        entity.setAddToIdToken(request.addToIdTokenValue());
        entity.setAddToUserInfo(request.addToUserInfoValue());
    }

    private OrganizationEntity organization(Long id) {
        return organizationRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Organization not found"));
    }

    private UserEntity user(Long id) {
        return userRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private OrganizationMemberEntity member(Long organizationId, Long userId) {
        organization(organizationId);
        return memberRepository
                .findByOrganizationIdAndUserId(organizationId, userId)
                .orElseThrow(() -> ApiException.notFound("Organization member not found"));
    }

    private OrganizationDomainEntity domain(Long organizationId, Long domainId) {
        organization(organizationId);
        return domainRepository
                .findByIdAndOrganizationId(domainId, organizationId)
                .orElseThrow(() -> ApiException.notFound("Organization domain not found"));
    }

    private OrganizationInvitationEntity invitation(Long organizationId, Long invitationId) {
        organization(organizationId);
        return invitationRepository
                .findById(invitationId)
                .filter(invitation -> invitation.getOrganization().getId().equals(organizationId))
                .orElseThrow(() -> ApiException.notFound("Organization invitation not found"));
    }

    private OrganizationGroupEntity group(Long organizationId, Long groupId) {
        organization(organizationId);
        return groupRepository
                .findByIdAndOrganizationId(groupId, organizationId)
                .orElseThrow(() -> ApiException.notFound("Organization group not found"));
    }

    private OrganizationGroupEntity resolveParent(
            Long organizationId, Long parentId, OrganizationGroupEntity current) {
        if (parentId == null) {
            return null;
        }
        if (current != null && current.getId().equals(parentId)) {
            throw ApiException.badRequest(
                    ApiErrorCode.ORGANIZATION_GROUP_INVALID_PARENT,
                    "A group cannot be its own parent");
        }
        return group(organizationId, parentId);
    }

    private OrganizationClaimEntity claim(Long organizationId, Long claimId) {
        organization(organizationId);
        return claimRepository
                .findByIdAndOrganizationId(claimId, organizationId)
                .orElseThrow(() -> ApiException.notFound("Organization claim not found"));
    }

    private AdminOrganizationDTO organizationView(OrganizationEntity entity) {
        return new AdminOrganizationDTO(
                entity.getId(),
                entity.getAlias(),
                entity.getName(),
                entity.getDisplayName(),
                entity.getDescription(),
                entity.isEnabled(),
                memberRepository.countByOrganizationId(entity.getId()),
                domainRepository.countByOrganizationId(entity.getId()),
                groupRepository.countByOrganizationId(entity.getId()),
                claimRepository.findByOrganizationIdOrderByClaimNameAsc(entity.getId()).size(),
                providerRepository
                        .findByOrganizationIdOrderByProviderAliasAsc(entity.getId())
                        .size());
    }

    private AdminOrganizationMemberDTO memberView(OrganizationMemberEntity member) {
        return memberView(member.getUser(), member.getId(), member.getRole(), member.getJoinedAt());
    }

    private AdminOrganizationMemberDTO memberView(UserEntity user) {
        return memberView(user, null, null, null);
    }

    private AdminOrganizationMemberDTO memberView(
            UserEntity user, Long id, String role, java.time.Instant joinedAt) {
        return new AdminOrganizationMemberDTO(
                id, user.getId(), user.getUsername(), user.getEmail(), role, joinedAt);
    }

    private AdminOrganizationDomainDTO domainView(OrganizationDomainEntity domain) {
        return new AdminOrganizationDomainDTO(
                domain.getId(),
                domain.getDomain(),
                domain.isVerified(),
                domain.getVerificationToken(),
                domain.getVerifiedAt());
    }

    private AdminOrganizationInvitationDTO invitationView(
            OrganizationInvitationEntity invitation, String token) {
        return new AdminOrganizationInvitationDTO(
                invitation.getId(),
                invitation.getEmail(),
                invitation.getRole(),
                invitation.getExpiresAt(),
                invitation.getAcceptedAt(),
                invitation.getRevokedAt(),
                token);
    }

    private AdminOrganizationGroupDTO groupView(OrganizationGroupEntity group) {
        return new AdminOrganizationGroupDTO(
                group.getId(),
                group.getName(),
                group.getParent() == null ? null : group.getParent().getId(),
                groupMemberRepository.countByGroupId(group.getId()));
    }

    private AdminOrganizationClaimDTO claimView(OrganizationClaimEntity claim) {
        return new AdminOrganizationClaimDTO(
                claim.getId(),
                claim.getClaimName(),
                claim.getClaimValue(),
                claim.isAddToAccessToken(),
                claim.isAddToIdToken(),
                claim.isAddToUserInfo());
    }

    private AdminOrganizationIdentityProviderDTO providerView(String alias) {
        SocialProviderEntity provider =
                socialProviderRepository
                        .findByAliasIgnoreCase(alias)
                        .orElseThrow(() -> ApiException.notFound("Identity provider not found"));
        return providerView(provider);
    }

    private AdminOrganizationIdentityProviderDTO providerView(SocialProviderEntity provider) {
        return new AdminOrganizationIdentityProviderDTO(
                provider.getAlias(),
                provider.getProviderType(),
                provider.getDisplayName(),
                provider.isEnabled());
    }

    private void invalidateOrganizationMembers(Long organizationId) {
        memberRepository.findByOrganizationId(organizationId).stream()
                .map(OrganizationMemberEntity::getUser)
                .forEach(this::invalidateUser);
    }

    private void invalidateUser(UserEntity user) {
        userAccessInvalidationService.invalidate(user.getUsername());
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static String normalizeAlias(String value) {
        return normalize(value).toLowerCase(Locale.ROOT);
    }

    private static String normalizeDomain(String value) {
        String domain = normalize(value).toLowerCase(Locale.ROOT);
        if (domain.startsWith("https://") || domain.startsWith("http://") || domain.contains("/")) {
            throw ApiException.badRequest(
                    "domain",
                    ApiErrorCode.ORGANIZATION_INVALID_DOMAIN,
                    "Domain must be a DNS name");
        }
        return domain;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String randomToken() {
        return UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
    }

    private static String hash(String value) {
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
