package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;

@Schema(
        name = "MobileLoginActionRequest",
        description = "Values for a supported pending required action.")
public record MobileLoginActionRequestDTO(
        @Schema(description = "Action-specific values.", example = "{\"accepted\":true}")
                @NotNull
                @Size(max = 32)
                Map<String, Object> values) {}
