package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;

@Schema(name = "AdminOrganization", description = "An organization within the single issuer.")
public record AdminOrganizationDTO(
        @Schema(
                        description = "Internal identifier.",
                        example = "1",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Immutable organization alias.",
                        example = "acme",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String alias,
        @Schema(
                        description = "Display name.",
                        example = "Acme Corporation",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Optional post-login redirect URL.",
                        example = "https://acme.example.com",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String redirectUrl,
        @Schema(
                        description = "Optional description.",
                        example = "Acme customer organization",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String description,
        @Schema(
                        description = "Whether the organization can be used for authentication.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean enabled,
        @Schema(
                        description = "Multi-valued organization attributes.",
                        example = "{\"tier\":[\"enterprise\"]}",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Map<String, List<String>> attributes) {}
