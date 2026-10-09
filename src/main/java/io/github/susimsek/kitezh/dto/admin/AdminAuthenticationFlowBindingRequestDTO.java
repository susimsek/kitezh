package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(
        name = "AdminAuthenticationFlowBindingRequest",
        description = "Select a top-level flow for an application entry point.")
public record AdminAuthenticationFlowBindingRequestDTO(
        @NotNull
                @Schema(
                        description = "Top-level flow identifier.",
                        example = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long flowId) {}
