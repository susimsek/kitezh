package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(
        name = "AdminSearchResponse",
        description = "Permission-filtered global administration search results.")
public record AdminSearchResponseDTO(
        @Schema(
                        description = "Matching resources grouped in one result list.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<AdminSearchResultDTO> results) {}
