package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminOrganizationClaimRequest", description = "Organization token claim request.")
public record AdminOrganizationClaimRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 200, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Claim name.",
                        example = "organization",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String claimName,
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 2000, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Claim value.",
                        example = "acme",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String claimValue,
        @Schema(description = "Add to access tokens.", example = "true") Boolean addToAccessToken,
        @Schema(description = "Add to ID tokens.", example = "false") Boolean addToIdToken,
        @Schema(description = "Add to UserInfo.", example = "true") Boolean addToUserInfo) {

    public boolean addToAccessTokenValue() {
        return addToAccessToken == null || addToAccessToken;
    }

    public boolean addToIdTokenValue() {
        return Boolean.TRUE.equals(addToIdToken);
    }

    public boolean addToUserInfoValue() {
        return Boolean.TRUE.equals(addToUserInfo);
    }
}
