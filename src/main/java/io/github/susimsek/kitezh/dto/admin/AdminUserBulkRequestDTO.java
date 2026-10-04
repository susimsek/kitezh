package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(
        name = "AdminUserBulkRequest",
        description = "Bulk lifecycle operation for selected user accounts.")
public record AdminUserBulkRequestDTO(
        @NotEmpty(message = "{app.api.problem.violation.required}")
                @Size(max = 100, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Internal identifiers of the selected users.",
                        example = "[2, 3]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<@NotNull(message = "{app.api.problem.violation.required}") Long> userIds,
        @NotNull(message = "{app.api.problem.violation.required}")
                @Schema(
                        description = "Lifecycle operation to apply to every selected user.",
                        example = "DISABLE",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                AdminUserBulkAction action) {}
