package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminSearchResult",
        description = "A permission-filtered global administration search result.")
public record AdminSearchResultDTO(
        @Schema(
                        description = "Search result resource type.",
                        example = "user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String type,
        @Schema(
                        description = "Resource identifier.",
                        example = "2",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Resource display name.",
                        example = "admin",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String title,
        @Schema(
                        description = "Optional secondary display text.",
                        example = "admin@example.com",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String subtitle,
        @Schema(
                        description = "Relative administration-console route.",
                        example = "/admin/users/2",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String href) {}
