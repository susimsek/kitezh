package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.OrganizationDomainVerificationStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "AdminOrganizationDomainVerification")
public record AdminOrganizationDomainVerificationDTO(
        @Schema(
                        description = "Domain identifier.",
                        example = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long domainId,
        @Schema(
                        description = "Domain verification status.",
                        example = "PENDING",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                OrganizationDomainVerificationStatus status,
        @Schema(
                        description = "Verification expiry.",
                        format = "date-time",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Instant expiresAt,
        @Schema(
                        description = "Verification timestamp.",
                        format = "date-time",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Instant verifiedAt) {}
