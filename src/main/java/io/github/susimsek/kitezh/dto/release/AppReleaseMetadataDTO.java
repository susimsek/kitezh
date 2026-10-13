package io.github.susimsek.kitezh.dto.release;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

@Schema(name = "AppReleaseMetadata", description = "Latest Kitezh application release metadata.")
public record AppReleaseMetadataDTO(
        @Schema(
                        description = "Git tag of the release.",
                        example = "v0.1.0",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String tag,
        @Schema(
                        description = "Semantic release version.",
                        example = "0.1.0",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String version,
        @Schema(
                        description = "GitHub release page.",
                        example = "https://github.com/susimsek/kitezh/releases/tag/v0.1.0",
                        format = "uri",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String releaseUrl,
        @Schema(
                        description = "Allowlisted versioned application asset URLs.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Map<String, String> assets) {}
