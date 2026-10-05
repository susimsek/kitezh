package io.github.susimsek.kitezh.dto.userprofile;

import io.github.susimsek.kitezh.domain.UserProfileAttributeType;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UserProfileAttributeDefinition", description = "Configurable user profile field.")
public record UserProfileAttributeDefinitionDTO(
        @Schema(
                        description = "Definition identifier.",
                        example = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Stable attribute name.",
                        example = "department",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Localized display label.",
                        example = "Department",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String displayName,
        @Schema(
                        description = "Optional help text.",
                        example = "The user's department.",
                        nullable = true)
                String description,
        @Schema(
                        description = "Validation value type.",
                        example = "STRING",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                UserProfileAttributeType type,
        @Schema(description = "Whether at least one value is required.", example = "false")
                boolean required,
        @Schema(description = "Whether multiple values are allowed.", example = "false")
                boolean multivalued,
        @Schema(description = "Minimum value length.", example = "2", nullable = true)
                Integer minLength,
        @Schema(description = "Maximum value length.", example = "100", nullable = true)
                Integer maxLength,
        @Schema(
                        description = "Optional Java regular expression.",
                        example = "^[A-Z].*$",
                        nullable = true)
                String pattern,
        @Schema(description = "Whether the definition is shown in profile forms.", example = "true")
                boolean enabled,
        @Schema(description = "Display order.", example = "10") int displayOrder,
        @Schema(
                        description = "Whether this is a protected built-in profile attribute.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean builtIn) {}
