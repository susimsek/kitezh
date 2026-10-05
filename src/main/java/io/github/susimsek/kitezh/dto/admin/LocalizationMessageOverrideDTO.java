package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "LocalizationMessageOverride", description = "A locale-specific message override.")
public record LocalizationMessageOverrideDTO(
        @Schema(
                        description = "Override identifier.",
                        example = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Locale tag.",
                        example = "tr",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String locale,
        @Schema(
                        description = "Message bundle namespace.",
                        example = "admin",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String bundle,
        @Schema(
                        description = "Message bundle key.",
                        example = "login.title",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String messageKey,
        @Schema(
                        description = "Localized message value.",
                        example = "Oturum aç",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String messageValue) {}
