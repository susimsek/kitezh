package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.OrganizationMemberEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationMemberRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminOrganizationMemberService {

    private static final String ORGANIZATION_TARGET = "organization";

    private final OrganizationRepository organizationRepository;
    private final OrganizationMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final AdminAuditEventService adminAuditEventService;

    @Transactional(readOnly = true)
    public Page<AdminOrganizationMemberDTO> findAll(
            Long organizationId, String query, Pageable pageable) {
        findOrganization(organizationId);
        String normalized = query == null ? "" : query.strip();
        return memberRepository
                .searchByOrganizationId(organizationId, normalized, pageable)
                .map(AdminOrganizationMemberService::toDTO);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminOrganizationMemberDTO add(
            Long organizationId, AdminOrganizationMemberRequestDTO request) {
        OrganizationEntity organization = findOrganization(organizationId);
        UserEntity user = findUser(request.userId());
        if (memberRepository.existsByOrganizationIdAndUserId(organizationId, user.getId())) {
            throw ApiException.conflict(
                    "userId",
                    ApiErrorCode.ORGANIZATION_MEMBER_ALREADY_EXISTS,
                    "User is already an organization member");
        }
        OrganizationMemberEntity member = new OrganizationMemberEntity();
        member.setOrganization(organization);
        member.setUser(user);
        member.setMembershipType(request.membershipTypeValue());
        OrganizationMemberEntity saved = memberRepository.save(member);
        userAccessInvalidationService.invalidate(user.getUsername());
        adminAuditEventService.record(
                "organization.member.added",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "userId=" + user.getId());
        return toDTO(saved);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminOrganizationMemberDTO update(
            Long organizationId, Long userId, AdminOrganizationMemberRequestDTO request) {
        findOrganization(organizationId);
        OrganizationMemberEntity member =
                memberRepository
                        .findByOrganizationIdAndUserId(organizationId, userId)
                        .orElseThrow(() -> ApiException.notFound("Organization member not found"));
        member.setMembershipType(request.membershipTypeValue());
        userAccessInvalidationService.invalidate(member.getUser().getUsername());
        adminAuditEventService.record(
                "organization.member.updated",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "userId=" + userId);
        return toDTO(member);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void remove(Long organizationId, Long userId) {
        findOrganization(organizationId);
        OrganizationMemberEntity member =
                memberRepository
                        .findByOrganizationIdAndUserId(organizationId, userId)
                        .orElseThrow(() -> ApiException.notFound("Organization member not found"));
        memberRepository.delete(member);
        userAccessInvalidationService.invalidate(member.getUser().getUsername());
        adminAuditEventService.record(
                "organization.member.removed",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "userId=" + userId);
    }

    private OrganizationEntity findOrganization(Long id) {
        return organizationRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Organization not found"));
    }

    private UserEntity findUser(Long id) {
        return userRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private static AdminOrganizationMemberDTO toDTO(OrganizationMemberEntity member) {
        UserEntity user = member.getUser();
        return new AdminOrganizationMemberDTO(
                member.getId(),
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                member.getMembershipType());
    }
}
