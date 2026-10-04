package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(
        name = "AdminUserEnabledRequest",
        description = "Request to enable or disable a user account.")
public record AdminUserEnabledRequestDTO(
        @NotNull(message = "{app.api.problem.violation.required}")
                @Schema(
                        description = "Whether the account should be enabled.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Boolean enabled) {}
