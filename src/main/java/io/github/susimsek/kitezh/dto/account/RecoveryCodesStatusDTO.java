package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "RecoveryCodesStatus", description = "MFA recovery code status.")
public record RecoveryCodesStatusDTO(
        @Schema(
                        description = "Number of unused recovery codes.",
                        example = "8",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int remaining,
        @Schema(
                        description = "Warn when unused recovery codes reach this count.",
                        example = "2",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int warningThreshold) {

    public RecoveryCodesStatusDTO(int remaining) {
        this(remaining, 0);
    }
}
