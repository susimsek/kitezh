package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminOrganizationRequest", description = "Organization create or update request.")
public record AdminOrganizationRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 100, message = "{app.api.problem.violation.max_length}")
                @Pattern(
                        regexp = "[a-z0-9][a-z0-9-]*",
                        message = "{app.api.problem.organization.invalid_alias}")
                @Schema(
                        description = "Lowercase stable alias.",
                        example = "acme",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String alias,
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 200, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Organization name.",
                        example = "Acme Corporation",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Size(max = 200, message = "{app.api.problem.violation.max_length}")
                @Schema(description = "Display name.", example = "Acme", nullable = true)
                String displayName,
        @Size(max = 2000, message = "{app.api.problem.violation.max_length}")
                @Schema(description = "Description.", example = "Acme workforce", nullable = true)
                String description,
        @Schema(description = "Enable the organization.", example = "true") Boolean enabled) {

    public boolean enabledValue() {
        return enabled == null || enabled;
    }
}
