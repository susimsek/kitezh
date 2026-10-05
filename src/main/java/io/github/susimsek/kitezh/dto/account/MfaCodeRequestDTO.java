package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Schema(name = "MfaCodeRequest", description = "TOTP verification code.")
public record MfaCodeRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Pattern(regexp = "\\d{6,8}", message = "{app.api.problem.invalid_totp_code}")
                @Schema(
                        description = "Current authenticator code.",
                        example = "123456",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String code) {}
