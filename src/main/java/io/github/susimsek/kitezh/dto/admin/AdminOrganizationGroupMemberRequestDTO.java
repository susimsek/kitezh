package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(
        name = "AdminOrganizationGroupMemberRequest",
        description = "Adds an existing organization member to a group.")
public record AdminOrganizationGroupMemberRequestDTO(
        @NotNull(message = "{app.api.problem.violation.required}")
                @Schema(
                        description = "User identifier.",
                        example = "2",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long userId) {}
