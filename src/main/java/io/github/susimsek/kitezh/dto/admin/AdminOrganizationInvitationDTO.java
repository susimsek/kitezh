package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "AdminOrganizationInvitation", description = "An organization invitation.")
public record AdminOrganizationInvitationDTO(
        @Schema(description = "Invitation identifier.", example = "1") Long id,
        @Schema(description = "Invitee email.", example = "person@example.com") String email,
        @Schema(description = "Role granted on acceptance.", example = "MEMBER") String role,
        @Schema(description = "Expiration time.", format = "date-time") Instant expiresAt,
        @Schema(description = "Acceptance time.", format = "date-time", nullable = true)
                Instant acceptedAt,
        @Schema(description = "Revocation time.", format = "date-time", nullable = true)
                Instant revokedAt,
        @Schema(
                        description = "One-time invitation token; returned only when created.",
                        nullable = true)
                String token) {}
