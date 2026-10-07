package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminOrganizationIdentityProviderRequest",
        description = "Organization identity-provider binding request.")
public record AdminOrganizationIdentityProviderRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 50, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Provider alias or registration id.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String providerAlias,
        @Schema(
                        description = "Whether the binding is enabled.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean enabled) {

    public boolean enabledValue() {
        return enabled == null || enabled;
    }
}
