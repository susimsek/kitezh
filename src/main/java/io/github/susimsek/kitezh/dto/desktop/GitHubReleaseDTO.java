package io.github.susimsek.kitezh.dto.desktop;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(name = "GitHubRelease", description = "GitHub release metadata used by the download page.")
public record GitHubReleaseDTO(
        @JsonProperty("tag_name")
                @Schema(
                        description = "Release tag.",
                        example = "v0.1.0",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String tagName,
        @Schema(description = "Release assets.", requiredMode = Schema.RequiredMode.REQUIRED)
                List<GitHubReleaseAssetDTO> assets) {}
