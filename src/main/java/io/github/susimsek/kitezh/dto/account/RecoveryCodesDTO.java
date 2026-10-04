package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(
        name = "RecoveryCodes",
        description = "One-time MFA recovery codes returned once after generation.")
public record RecoveryCodesDTO(
        @Schema(
                        description =
                                "New recovery codes. Store them securely; they cannot be read"
                                        + " again.",
                        example = "[\"ABCD-EFGH-IJKL\", \"MNOP-QRST-UVWX\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<String> codes,
        @Schema(
                        description = "Number of unused recovery codes after generation.",
                        example = "12",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int remaining) {}
