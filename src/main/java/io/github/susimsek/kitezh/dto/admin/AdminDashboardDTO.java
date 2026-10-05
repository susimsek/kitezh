package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminDashboard", description = "Administration dashboard resource counts.")
public record AdminDashboardDTO(
        @Schema(
                        description = "Number of registered OAuth2 clients.",
                        example = "4",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                long clients,
        @Schema(
                        description = "Number of users.",
                        example = "12",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                long users,
        @Schema(
                        description = "Number of browser sessions.",
                        example = "6",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                long sessions,
        @Schema(
                        description = "Number of OAuth2 consents.",
                        example = "8",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                long consents) {}
