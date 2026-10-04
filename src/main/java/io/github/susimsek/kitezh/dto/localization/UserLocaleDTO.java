package io.github.susimsek.kitezh.dto.localization;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UserLocale", description = "The authenticated user's persisted locale preference.")
public record UserLocaleDTO(
        @Schema(
                        description =
                                "BCP 47 language tag, or null when the user follows the application"
                                        + " locale.",
                        example = "tr",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String locale) {}
