package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminOrganizationIdentityProviderRequest",
        description = "Organization identity-provider link request.")
public record AdminOrganizationIdentityProviderRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 100, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Configured provider alias.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String providerAlias) {}
