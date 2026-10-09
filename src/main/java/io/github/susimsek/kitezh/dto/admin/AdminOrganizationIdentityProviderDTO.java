package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminOrganizationIdentityProvider",
        description = "An identity provider linked to an organization.")
public record AdminOrganizationIdentityProviderDTO(
        @Schema(description = "Provider alias.", example = "google") String providerAlias,
        @Schema(description = "Provider type.", example = "oidc") String providerType,
        @Schema(description = "Provider display name.", example = "Google") String displayName,
        @Schema(description = "Whether the provider is enabled.", example = "true")
                boolean enabled) {}
