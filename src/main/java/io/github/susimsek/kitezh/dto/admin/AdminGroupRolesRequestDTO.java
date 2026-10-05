package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Set;

@Schema(
        name = "AdminGroupRolesRequest",
        description = "The complete realm-role mapping for a group.")
public record AdminGroupRolesRequestDTO(
        @NotNull(message = "{app.api.problem.violation.required}")
                @Size(max = 100, message = "{app.api.problem.violation.max_items}")
                @Schema(
                        description = "Complete set of realm roles mapped to the group.",
                        example = "[\"ROLE_USER_VIEWER\", \"ROLE_CLIENT_VIEWER\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<@NotBlank(message = "{app.api.problem.violation.roles}") String> roles) {}
