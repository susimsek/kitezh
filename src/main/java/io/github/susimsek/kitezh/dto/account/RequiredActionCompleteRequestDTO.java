package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

@Schema(name = "RequiredActionCompletion", description = "Values submitted for a required action.")
public record RequiredActionCompleteRequestDTO(
        @Schema(
                        description = "Action-specific values.",
                        example = "{\"accepted\":true}",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Map<String, Object> values) {}
