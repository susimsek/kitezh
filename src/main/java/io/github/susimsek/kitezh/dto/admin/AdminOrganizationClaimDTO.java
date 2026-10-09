package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminOrganizationClaim", description = "An organization token claim.")
public record AdminOrganizationClaimDTO(
        @Schema(description = "Claim identifier.", example = "1") Long id,
        @Schema(description = "Claim name.", example = "organization") String claimName,
        @Schema(description = "Claim value.", example = "acme") String claimValue,
        @Schema(description = "Add to access tokens.", example = "true") boolean addToAccessToken,
        @Schema(description = "Add to ID tokens.", example = "false") boolean addToIdToken,
        @Schema(description = "Add to UserInfo.", example = "true") boolean addToUserInfo) {}
