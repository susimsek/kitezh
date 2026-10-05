package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminUserBulkOperation",
        description = "Result of a successful bulk user lifecycle operation.")
public record AdminUserBulkOperationDTO(
        @Schema(
                        description = "Lifecycle operation that was applied.",
                        example = "DISABLE",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                AdminUserBulkAction action,
        @Schema(
                        description = "Number of distinct user accounts changed.",
                        example = "2",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int userCount) {}
