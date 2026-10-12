package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminOrganizationGroupRequest", description = "Organization group request.")
public record AdminOrganizationGroupRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 100, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Group name.",
                        example = "engineering",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(description = "Parent group identifier.", example = "2", nullable = true)
                Long parentId) {}
