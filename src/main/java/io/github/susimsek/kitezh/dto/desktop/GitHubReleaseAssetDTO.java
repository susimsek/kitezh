package io.github.susimsek.kitezh.dto.desktop;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;

@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(name = "GitHubReleaseAsset", description = "GitHub release asset metadata.")
public record GitHubReleaseAssetDTO(
        @Schema(
                        description = "Asset file name.",
                        example = "kitezh-0.1.0-linux-x86_64.AppImage",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name) {}
