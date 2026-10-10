package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminOrganization", description = "An organization in the configured issuer.")
public record AdminOrganizationDTO(
        @Schema(
                        description = "Organization identifier.",
                        example = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Stable organization alias.",
                        example = "acme",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String alias,
        @Schema(
                        description = "Organization name.",
                        example = "Acme Corporation",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(description = "Optional display name.", example = "Acme", nullable = true)
                String displayName,
        @Schema(
                        description = "Organization description.",
                        example = "Acme workforce",
                        nullable = true)
                String description,
        @Schema(description = "Whether the organization accepts authentication.", example = "true")
                boolean enabled,
        @Schema(description = "Number of members.", example = "12") long memberCount,
        @Schema(description = "Number of domains.", example = "2") long domainCount,
        @Schema(description = "Number of organization groups.", example = "3") long groupCount,
        @Schema(description = "Number of organization claims.", example = "1") long claimCount,
        @Schema(description = "Number of linked identity providers.", example = "1")
                long identityProviderCount) {}
