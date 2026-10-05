package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.ImpersonationTicketEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminImpersonationDTO;
import io.github.susimsek.kitezh.mapper.AdminImpersonationMapper;
import io.github.susimsek.kitezh.mapper.AdminImpersonationTicketMapper;
import io.github.susimsek.kitezh.repository.ImpersonationTicketRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ImpersonationService {

    private static final Duration TICKET_LIFESPAN = Duration.ofSeconds(60);
    private final UserRepository userRepository;
    private final UserDetailsService userDetailsService;
    private final ImpersonationTicketRepository ticketRepository;
    private final AdminAuditEventService auditEventService;
    private final AdminImpersonationMapper adminImpersonationMapper;
    private final AdminImpersonationTicketMapper adminImpersonationTicketMapper;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public AdminImpersonationDTO issue(Long targetId, Authentication actor) {
        requireCanImpersonate(actor);
        String actorUsername = actor.getName();
        UserEntity target =
                userRepository
                        .findById(targetId)
                        .orElseThrow(() -> ApiException.notFound("User not found"));
        if (target.getUsername().equals(actorUsername)) {
            throw ApiException.badRequest(
                    ApiErrorCode.USER_PROTECTED, "You cannot impersonate yourself");
        }
        if (!target.isEnabled()) {
            throw ApiException.badRequest(
                    ApiErrorCode.USER_PROTECTED, "Disabled users cannot be impersonated");
        }
        if (userDetailsService.loadUserByUsername(target.getUsername()).getAuthorities().stream()
                .anyMatch(a -> AuthoritiesConstants.ADMIN.equals(a.getAuthority()))) {
            throw ApiException.forbidden(
                    ApiErrorCode.USER_PROTECTED, "Administrators cannot be impersonated");
        }
        byte[] value = new byte[32];
        secureRandom.nextBytes(value);
        String rawTicket = Base64.getUrlEncoder().withoutPadding().encodeToString(value);
        Instant issuedAt = Instant.now();
        ImpersonationTicketEntity ticket =
                adminImpersonationTicketMapper.toEntity(
                        hash(rawTicket),
                        actorUsername,
                        target,
                        issuedAt,
                        issuedAt.plus(TICKET_LIFESPAN));
        ticketRepository.save(ticket);
        auditEventService.record(
                "user.impersonation.started",
                "user",
                targetId.toString(),
                "actor="
                        + actorUsername
                        + ";targetUsername="
                        + target.getUsername()
                        + ";result=success");
        return adminImpersonationMapper.toDTO(
                "/impersonation/accept", target.getUsername(), rawTicket);
    }

    @Transactional
    public UserEntity consume(String rawTicket, Authentication actor) {
        requireCanImpersonate(actor);
        String actorUsername = actor.getName();
        if (rawTicket == null || rawTicket.isBlank()) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "Impersonation ticket is required");
        }
        ImpersonationTicketEntity ticket =
                ticketRepository
                        .findByTicketHash(hash(rawTicket))
                        .orElseThrow(
                                () ->
                                        ApiException.badRequest(
                                                ApiErrorCode.INVALID_REQUEST,
                                                "Impersonation ticket is invalid"));
        if (!ticket.getActorUsername().equals(actorUsername)
                || ticket.getConsumedAt() != null
                || !ticket.getExpiresAt().isAfter(Instant.now())) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "Impersonation ticket is invalid");
        }
        ticket.setConsumedAt(Instant.now());
        UserEntity target = ticket.getTargetUser();
        target.getId();
        target.getUsername();
        return target;
    }

    private static void requireCanImpersonate(Authentication actor) {
        if (actor == null
                || actor.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .noneMatch(
                                authority ->
                                        AuthoritiesConstants.ADMIN.equals(authority)
                                                || AuthoritiesConstants.USER_IMPERSONATOR.equals(
                                                        authority))) {
            throw ApiException.forbidden(
                    ApiErrorCode.FORBIDDEN,
                    "The impersonation permission is required to impersonate users");
        }
    }

    private static String hash(String value) {
        try {
            return java.util.HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
