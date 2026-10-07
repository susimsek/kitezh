package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.OrganizationDomainEntity;
import io.github.susimsek.kitezh.domain.OrganizationDomainVerificationStatus;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainVerificationDTO;
import io.github.susimsek.kitezh.repository.OrganizationDomainRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.SecurityUtils;
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
import java.util.HexFormat;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OrganizationDomainVerificationService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationDomainRepository domainRepository;
    private final UserRepository userRepository;
    private final AdminAuditEventService auditEventService;
    private final MailService mailService;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public AdminOrganizationDomainVerificationDTO start(Long organizationId, Long domainId) {
        requireOrganization(organizationId);
        OrganizationDomainEntity domain = requireDomain(organizationId, domainId);
        String username =
                SecurityUtils.getCurrentUserLogin()
                        .orElseThrow(
                                () ->
                                        ApiException.forbidden(
                                                ApiErrorCode.FORBIDDEN,
                                                "Authenticated administrator required"));
        String recipient =
                userRepository
                        .findByUsername(username)
                        .map(user -> user.getEmail())
                        .filter(email -> email != null && !email.isBlank())
                        .orElseThrow(
                                () ->
                                        ApiException.badRequest(
                                                "email",
                                                ApiErrorCode
                                                        .ORGANIZATION_DOMAIN_VERIFICATION_EMAIL_REQUIRED,
                                                "The administrator must have an email address"));
        String rawToken = createRawToken();
        domain.setVerificationTokenHash(hash(rawToken));
        domain.setVerificationExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS));
        domain.setVerifiedAt(null);
        domain.setVerificationStatus(OrganizationDomainVerificationStatus.PENDING);
        mailService.sendOrganizationDomainVerification(
                recipient, domain.getDomain(), rawToken, Locale.ENGLISH);
        auditEventService.record(
                "organization.domain.verification.started",
                "organization",
                organizationId.toString(),
                "domain=" + domain.getDomain());
        return toDTO(domain);
    }

    @Transactional
    public AdminOrganizationDomainVerificationDTO verify(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_TOKEN_INVALID, "Domain verification token is invalid");
        }
        OrganizationDomainEntity domain =
                domainRepository
                        .findByVerificationTokenHash(hash(rawToken))
                        .orElseThrow(
                                () ->
                                        ApiException.badRequest(
                                                ApiErrorCode.ACTION_TOKEN_INVALID,
                                                "Domain verification token is invalid"));
        if (domain.getVerificationExpiresAt() == null
                || !domain.getVerificationExpiresAt().isAfter(Instant.now())) {
            domain.setVerificationStatus(OrganizationDomainVerificationStatus.EXPIRED);
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_TOKEN_EXPIRED, "Domain verification token expired");
        }
        domain.setVerificationStatus(OrganizationDomainVerificationStatus.VERIFIED);
        domain.setVerifiedAt(Instant.now());
        domain.setVerificationTokenHash(null);
        auditEventService.record(
                "organization.domain.verified",
                "organization",
                domain.getOrganization().getId().toString(),
                "domain=" + domain.getDomain());
        return toDTO(domain);
    }

    private OrganizationDomainEntity requireDomain(Long organizationId, Long domainId) {
        return domainRepository
                .findById(domainId)
                .filter(domain -> domain.getOrganization().getId().equals(organizationId))
                .orElseThrow(() -> ApiException.notFound("Organization domain not found"));
    }

    private void requireOrganization(Long organizationId) {
        organizationRepository
                .findById(organizationId)
                .orElseThrow(() -> ApiException.notFound("Organization not found"));
    }

    private static AdminOrganizationDomainVerificationDTO toDTO(OrganizationDomainEntity domain) {
        return new AdminOrganizationDomainVerificationDTO(
                domain.getId(),
                domain.getVerificationStatus(),
                domain.getVerificationExpiresAt(),
                domain.getVerifiedAt());
    }

    private String createRawToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String rawToken) {
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
