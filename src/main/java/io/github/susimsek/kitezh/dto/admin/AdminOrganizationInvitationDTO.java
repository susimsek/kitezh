package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.OrganizationInvitationStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "AdminOrganizationInvitation", description = "An organization invitation.")
public record AdminOrganizationInvitationDTO(
        @Schema(
                        description = "Invitation identifier.",
                        example = "1",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Invited email.",
                        example = "alice@example.com",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String email,
        @Schema(
                        description = "Optional invitee name.",
                        example = "Alice Smith",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String name,
        @Schema(
                        description = "Invitation status.",
                        example = "PENDING",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                OrganizationInvitationStatus status,
        @Schema(
                        description = "Expiration time.",
                        example = "2026-10-01T18:00:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant expiresAt,
        @Schema(
                        description = "One-time token returned only when an invitation is created.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String token) {}
