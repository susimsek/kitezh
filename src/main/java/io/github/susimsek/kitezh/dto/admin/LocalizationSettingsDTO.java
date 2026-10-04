package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(name = "LocalizationSettings", description = "Application localization settings.")
public record LocalizationSettingsDTO(
        @Schema(
                        description = "Whether localization is enabled.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean internationalizationEnabled,
        @Schema(
                        description = "Default locale.",
                        example = "en",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String defaultLocale,
        @Schema(
                        description = "Enabled locales.",
                        example = "[\"en\",\"tr\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<String> supportedLocales,
        @Schema(
                        description = "Locales available in this build.",
                        example = "[\"en\",\"tr\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<String> availableLocales,
        @Schema(
                        description = "Message bundles available in this build.",
                        example = "[\"backend\",\"common\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<String> availableBundles) {}
