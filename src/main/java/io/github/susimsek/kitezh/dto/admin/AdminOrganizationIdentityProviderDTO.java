package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminOrganizationIdentityProvider",
        description = "An identity provider bound to an organization.")
public record AdminOrganizationIdentityProviderDTO(
        @Schema(
                        description = "Binding identifier.",
                        example = "1",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Identity provider alias.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String providerAlias,
        @Schema(
                        description = "Whether this provider is available for the organization.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean enabled) {}
