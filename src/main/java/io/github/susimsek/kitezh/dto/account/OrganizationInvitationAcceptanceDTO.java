package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "OrganizationInvitationAcceptance",
        description = "Accepted organization invitation.")
public record OrganizationInvitationAcceptanceDTO(
        @Schema(
                        description = "Organization identifier.",
                        example = "1",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long organizationId,
        @Schema(
                        description = "Organization alias.",
                        example = "acme",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String organizationAlias,
        @Schema(
                        description = "Organization name.",
                        example = "Acme Corporation",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String organizationName) {}
