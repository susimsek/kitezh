package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Schema(name = "RecoveryCodeRequest", description = "MFA recovery code verification request.")
public record RecoveryCodeRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Pattern(
                        regexp = "[A-Za-z0-9]{4}(?:[- ]?[A-Za-z0-9]{4}){2}",
                        message = "{app.api.problem.invalid_recovery_code}")
                @Schema(
                        description = "One-time recovery code; separators are optional.",
                        example = "ABCD-EFGH-IJKL",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String code) {}
