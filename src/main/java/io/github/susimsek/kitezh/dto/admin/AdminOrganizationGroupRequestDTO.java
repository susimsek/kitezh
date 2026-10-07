package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Set;

@Schema(
        name = "AdminOrganizationGroupRequest",
        description = "Organization group create or update request.")
public record AdminOrganizationGroupRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 100, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Group name.",
                        example = "billing-admins",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Size(max = 2000, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Optional description.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String description,
        @Schema(
                        description = "Whether the group contributes claims.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean enabled,
        @Size(max = 50, message = "{app.api.problem.violation.max_size}")
                @Schema(
                        description = "Organization-scoped roles.",
                        example = "[\"billing.read\"]",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Set<@NotBlank @Size(max = 100) String> roles) {

    public boolean enabledValue() {
        return enabled == null || enabled;
    }
}
