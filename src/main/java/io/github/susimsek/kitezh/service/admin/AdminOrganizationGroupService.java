package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.OrganizationGroupEntity;
import io.github.susimsek.kitezh.domain.OrganizationGroupMemberEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberDTO;
import io.github.susimsek.kitezh.repository.OrganizationGroupMemberRepository;
import io.github.susimsek.kitezh.repository.OrganizationGroupRepository;
import io.github.susimsek.kitezh.repository.OrganizationMemberRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminOrganizationGroupService {

    private static final String ORGANIZATION_TARGET = "organization";

    private final OrganizationRepository organizationRepository;
    private final OrganizationGroupRepository groupRepository;
    private final OrganizationGroupMemberRepository memberRepository;
    private final OrganizationMemberRepository organizationMemberRepository;
    private final UserRepository userRepository;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final AdminAuditEventService adminAuditEventService;

    @Transactional(readOnly = true)
    public Page<AdminOrganizationGroupDTO> findAll(
            Long organizationId, String query, Pageable pageable) {
        requireOrganization(organizationId);
        String normalized = query == null ? "" : query.strip();
        return groupRepository
                .searchByOrganizationId(organizationId, normalized, pageable)
                .map(AdminOrganizationGroupService::toDTO);
    }

    @Transactional(readOnly = true)
    public AdminOrganizationGroupDTO findById(Long organizationId, Long groupId) {
        return toDTO(requireGroup(organizationId, groupId));
    }

    @Transactional
    public AdminOrganizationGroupDTO create(
            Long organizationId, AdminOrganizationGroupRequestDTO request) {
        OrganizationEntity organization = requireOrganization(organizationId);
        String name = normalizeName(request.name());
        if (groupRepository.existsByOrganizationIdAndNameIgnoreCase(organizationId, name)) {
            throw ApiException.conflict(
                    "name",
                    ApiErrorCode.ORGANIZATION_GROUP_ALREADY_EXISTS,
                    "Organization group already exists");
        }
        OrganizationGroupEntity group = new OrganizationGroupEntity();
        group.setOrganization(organization);
        apply(group, request, name);
        OrganizationGroupEntity saved = groupRepository.save(group);
        adminAuditEventService.record(
                "organization.group.created",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "groupId=" + saved.getId());
        return toDTO(saved);
    }

    @Transactional
    public AdminOrganizationGroupDTO update(
            Long organizationId, Long groupId, AdminOrganizationGroupRequestDTO request) {
        OrganizationGroupEntity group = requireGroup(organizationId, groupId);
        String name = normalizeName(request.name());
        if (groupRepository.existsByOrganizationIdAndNameIgnoreCaseAndIdNot(
                organizationId, name, groupId)) {
            throw ApiException.conflict(
                    "name",
                    ApiErrorCode.ORGANIZATION_GROUP_ALREADY_EXISTS,
                    "Organization group already exists");
        }
        apply(group, request, name);
        adminAuditEventService.record(
                "organization.group.updated",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "groupId=" + groupId);
        return toDTO(group);
    }

    @Transactional(readOnly = true)
    public Page<AdminOrganizationMemberDTO> findMembers(
            Long organizationId, Long groupId, String query, Pageable pageable) {
        requireGroup(organizationId, groupId);
        String normalized = query == null ? "" : query.strip();
        return memberRepository
                .searchByGroupId(groupId, normalized, pageable)
                .map(AdminOrganizationGroupService::toMemberDTO);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminOrganizationMemberDTO addMember(Long organizationId, Long groupId, Long userId) {
        requireGroup(organizationId, groupId);
        UserEntity user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ApiException.notFound("User not found"));
        if (!organizationMemberRepository.existsByOrganizationIdAndUserId(organizationId, userId)) {
            throw ApiException.badRequest(
                    "userId",
                    ApiErrorCode.ORGANIZATION_GROUP_MEMBER_REQUIRED,
                    "User must be an organization member first");
        }
        if (memberRepository.existsByGroupIdAndUserId(groupId, userId)) {
            throw ApiException.conflict(
                    "userId",
                    ApiErrorCode.ORGANIZATION_GROUP_MEMBER_ALREADY_EXISTS,
                    "User is already in the organization group");
        }
        OrganizationGroupMemberEntity member = new OrganizationGroupMemberEntity();
        member.setGroup(requireGroup(organizationId, groupId));
        member.setUser(user);
        OrganizationGroupMemberEntity saved = memberRepository.save(member);
        userAccessInvalidationService.invalidate(user.getUsername());
        adminAuditEventService.record(
                "organization.group.member.added",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "groupId=" + groupId + ",userId=" + userId);
        return toMemberDTO(saved);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void removeMember(Long organizationId, Long groupId, Long userId) {
        requireGroup(organizationId, groupId);
        OrganizationGroupMemberEntity member =
                memberRepository
                        .findByGroupIdAndUserId(groupId, userId)
                        .orElseThrow(
                                () -> ApiException.notFound("Organization group member not found"));
        memberRepository.delete(member);
        userAccessInvalidationService.invalidate(member.getUser().getUsername());
        adminAuditEventService.record(
                "organization.group.member.removed",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "groupId=" + groupId + ",userId=" + userId);
    }

    private OrganizationEntity requireOrganization(Long organizationId) {
        return organizationRepository
                .findById(organizationId)
                .orElseThrow(() -> ApiException.notFound("Organization not found"));
    }

    private OrganizationGroupEntity requireGroup(Long organizationId, Long groupId) {
        OrganizationGroupEntity group =
                groupRepository
                        .findById(groupId)
                        .orElseThrow(() -> ApiException.notFound("Organization group not found"));
        if (!group.getOrganization().getId().equals(organizationId)) {
            throw ApiException.notFound("Organization group not found");
        }
        return group;
    }

    private static void apply(
            OrganizationGroupEntity group, AdminOrganizationGroupRequestDTO request, String name) {
        group.setName(name);
        group.setDescription(request.description() == null ? null : request.description().strip());
        group.setEnabled(request.enabledValue());
        Set<String> roles =
                request.roles() == null
                        ? Set.of()
                        : request.roles().stream()
                                .filter(value -> value != null && !value.isBlank())
                                .map(value -> value.strip().toLowerCase(Locale.ROOT))
                                .collect(Collectors.toCollection(LinkedHashSet::new));
        group.setRoles(roles);
    }

    private static String normalizeName(String value) {
        return value.strip();
    }

    private static AdminOrganizationGroupDTO toDTO(OrganizationGroupEntity group) {
        return new AdminOrganizationGroupDTO(
                group.getId(),
                group.getOrganization().getId(),
                group.getName(),
                group.getDescription(),
                group.isEnabled(),
                group.getRoles().stream().sorted().collect(Collectors.toUnmodifiableSet()));
    }

    private static AdminOrganizationMemberDTO toMemberDTO(OrganizationGroupMemberEntity member) {
        UserEntity user = member.getUser();
        return new AdminOrganizationMemberDTO(
                member.getId(),
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                io.github.susimsek.kitezh.domain.OrganizationMembershipType
                        .UNMANAGED);
    }
}
