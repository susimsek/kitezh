package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

@Schema(name = "AdminOrganizationRequest", description = "Organization create or update request.")
public record AdminOrganizationRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 100, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Immutable organization alias.",
                        example = "acme",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String alias,
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 200, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Display name.",
                        example = "Acme Corporation",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Size(max = 1000, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Optional absolute redirect URL.",
                        example = "https://acme.example.com",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String redirectUrl,
        @Size(max = 2000, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Optional description.",
                        example = "Acme customer organization",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String description,
        @Schema(
                        description = "Whether the organization is enabled.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean enabled,
        @Size(max = 50, message = "{app.api.problem.violation.max_size}")
                @Schema(
                        description = "Multi-valued organization attributes.",
                        example = "{\"tier\":[\"enterprise\"]}",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Map<
                                @NotBlank @Size(max = 100) String,
                                @Size(max = 20) List<@NotBlank @Size(max = 1000) String>>
                        attributes) {

    public boolean enabledValue() {
        return enabled == null || enabled;
    }
}
