package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(
        name = "AdminAuthenticationFlowNodeMoveRequest",
        description = "Move one flow node within its parent.")
public record AdminAuthenticationFlowNodeMoveRequestDTO(
        @NotBlank
                @Schema(
                        description = "Move direction.",
                        example = "UP",
                        allowableValues = {"UP", "DOWN"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String direction) {}
