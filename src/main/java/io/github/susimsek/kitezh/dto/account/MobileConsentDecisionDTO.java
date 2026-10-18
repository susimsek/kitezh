package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(name = "MobileConsentDecision", description = "Explicit native OAuth consent decision.")
public record MobileConsentDecisionDTO(
        @NotNull
                @Schema(
                        description =
                                "True only after the user explicitly approves the shown scopes.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Boolean approved) {}
