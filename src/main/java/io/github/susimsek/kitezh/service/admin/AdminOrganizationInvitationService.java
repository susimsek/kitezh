package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.OrganizationInvitationEntity;
import io.github.susimsek.kitezh.domain.OrganizationInvitationStatus;
import io.github.susimsek.kitezh.domain.OrganizationMemberEntity;
import io.github.susimsek.kitezh.domain.OrganizationMembershipType;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.OrganizationInvitationAcceptanceDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationInvitationRepository;
import io.github.susimsek.kitezh.repository.OrganizationMemberRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.mail.MailService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminOrganizationInvitationService {

    private static final String ORGANIZATION_TARGET = "organization";

    private final OrganizationRepository organizationRepository;
    private final OrganizationInvitationRepository invitationRepository;
    private final OrganizationMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final AdminAuditEventService adminAuditEventService;
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired(required = false)
    private MailService mailService;

    @Transactional(readOnly = true)
    public Page<AdminOrganizationInvitationDTO> findAll(Long organizationId, Pageable pageable) {
        findOrganization(organizationId);
        return invitationRepository
                .findByOrganizationId(organizationId, pageable)
                .map(entity -> toDTO(entity, null));
    }

    @Transactional
    public AdminOrganizationInvitationDTO create(
            Long organizationId, AdminOrganizationInvitationRequestDTO request) {
        OrganizationEntity organization = findOrganization(organizationId);
        String email = normalizeEmail(request.email());
        if (invitationRepository.existsByOrganizationIdAndEmailIgnoreCaseAndStatus(
                organizationId, email, OrganizationInvitationStatus.PENDING)) {
            throw ApiException.conflict(
                    "email",
                    ApiErrorCode.ORGANIZATION_INVITATION_ALREADY_EXISTS,
                    "A pending invitation already exists for this email");
        }
        String rawToken = createRawToken();
        OrganizationInvitationEntity invitation = new OrganizationInvitationEntity();
        invitation.setOrganization(organization);
        invitation.setEmail(email);
        invitation.setName(request.name() == null ? null : request.name().strip());
        invitation.setTokenHash(hash(rawToken));
        invitation.setExpiresAt(Instant.now().plus(request.lifespanHoursValue(), ChronoUnit.HOURS));
        invitation.setStatus(OrganizationInvitationStatus.PENDING);
        OrganizationInvitationEntity saved = invitationRepository.save(invitation);
        adminAuditEventService.record(
                "organization.invitation.created",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "email=" + email);
        sendInvitationEmail(saved, rawToken);
        return toDTO(saved, rawToken);
    }

    @Transactional
    public AdminOrganizationInvitationDTO resend(
            Long organizationId, Long invitationId, AdminOrganizationInvitationRequestDTO request) {
        OrganizationInvitationEntity invitation = requireInvitation(organizationId, invitationId);
        if (invitation.getStatus() == OrganizationInvitationStatus.ACCEPTED
                || invitation.getStatus() == OrganizationInvitationStatus.CANCELLED) {
            throw ApiException.conflict(
                    ApiErrorCode.ORGANIZATION_INVITATION_NOT_PENDING,
                    "Invitation is no longer pending");
        }
        String email = normalizeEmail(request.email());
        if (!email.equalsIgnoreCase(invitation.getEmail())) {
            throw ApiException.badRequest(
                    "email",
                    ApiErrorCode.ORGANIZATION_INVITATION_EMAIL_MISMATCH,
                    "The resend email must match the original invitation");
        }
        String rawToken = createRawToken();
        invitation.setTokenHash(hash(rawToken));
        invitation.setExpiresAt(Instant.now().plus(request.lifespanHoursValue(), ChronoUnit.HOURS));
        invitation.setStatus(OrganizationInvitationStatus.PENDING);
        invitation.setName(request.name() == null ? invitation.getName() : request.name().strip());
        adminAuditEventService.record(
                "organization.invitation.resent",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "email=" + email);
        sendInvitationEmail(invitation, rawToken);
        return toDTO(invitation, rawToken);
    }

    @Transactional
    public void cancel(Long organizationId, Long invitationId) {
        OrganizationInvitationEntity invitation = requireInvitation(organizationId, invitationId);
        if (invitation.getStatus() != OrganizationInvitationStatus.PENDING) {
            throw ApiException.conflict(
                    ApiErrorCode.ORGANIZATION_INVITATION_NOT_PENDING,
                    "Invitation is no longer pending");
        }
        invitation.setStatus(OrganizationInvitationStatus.CANCELLED);
        adminAuditEventService.record(
                "organization.invitation.cancelled",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "email=" + invitation.getEmail());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public OrganizationInvitationAcceptanceDTO accept(String rawToken, String username) {
        if (rawToken == null || rawToken.isBlank()) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_TOKEN_INVALID, "Invitation token is invalid");
        }
        OrganizationInvitationEntity invitation =
                invitationRepository
                        .findByTokenHash(hash(rawToken))
                        .orElseThrow(
                                () ->
                                        ApiException.badRequest(
                                                ApiErrorCode.ACTION_TOKEN_INVALID,
                                                "Invitation token is invalid"));
        if (invitation.getStatus() != OrganizationInvitationStatus.PENDING) {
            throw ApiException.conflict(
                    ApiErrorCode.ORGANIZATION_INVITATION_NOT_PENDING,
                    "Invitation is no longer pending");
        }
        if (!invitation.getExpiresAt().isAfter(Instant.now())) {
            invitation.setStatus(OrganizationInvitationStatus.EXPIRED);
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_TOKEN_EXPIRED, "Invitation token expired");
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
        if (!memberRepository.existsByOrganizationIdAndUserId(
                invitation.getOrganization().getId(), user.getId())) {
            OrganizationMemberEntity member = new OrganizationMemberEntity();
            member.setOrganization(invitation.getOrganization());
            member.setUser(user);
            member.setMembershipType(OrganizationMembershipType.UNMANAGED);
            memberRepository.save(member);
            userAccessInvalidationService.invalidate(user.getUsername());
        }
        invitation.setStatus(OrganizationInvitationStatus.ACCEPTED);
        invitation.setAcceptedAt(Instant.now());
        adminAuditEventService.record(
                "organization.invitation.accepted",
                ORGANIZATION_TARGET,
                invitation.getOrganization().getId().toString(),
                "userId=" + user.getId());
        OrganizationEntity organization = invitation.getOrganization();
        return new OrganizationInvitationAcceptanceDTO(
                organization.getId(), organization.getAlias(), organization.getName());
    }

    private OrganizationEntity findOrganization(Long id) {
        return organizationRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Organization not found"));
    }

    private OrganizationInvitationEntity requireInvitation(Long organizationId, Long invitationId) {
        return invitationRepository
                .findByOrganizationIdAndId(organizationId, invitationId)
                .orElseThrow(() -> ApiException.notFound("Organization invitation not found"));
    }

    private String createRawToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private void sendInvitationEmail(OrganizationInvitationEntity invitation, String rawToken) {
        if (mailService != null) {
            mailService.sendOrganizationInvitation(
                    invitation.getEmail(),
                    invitation.getName(),
                    invitation.getOrganization().getName(),
                    rawToken,
                    Locale.ENGLISH);
        }
    }

    private static AdminOrganizationInvitationDTO toDTO(
            OrganizationInvitationEntity entity, String token) {
        return new AdminOrganizationInvitationDTO(
                entity.getId(),
                entity.getEmail(),
                entity.getName(),
                currentStatus(entity),
                entity.getExpiresAt(),
                token);
    }

    private static OrganizationInvitationStatus currentStatus(OrganizationInvitationEntity entity) {
        if (entity.getStatus() == OrganizationInvitationStatus.PENDING
                && !entity.getExpiresAt().isAfter(Instant.now())) {
            entity.setStatus(OrganizationInvitationStatus.EXPIRED);
        }
        return entity.getStatus();
    }

    private static String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    private static String hash(String rawToken) {
        try {
            return java.util.HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
