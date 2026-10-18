package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Schema(
        name = "MobileLoginMfaRequest",
        description = "TOTP proof for a pending mobile login transaction.")
public record MobileLoginMfaRequestDTO(
        @Schema(description = "Authenticator code.", example = "123456")
                @NotBlank
                @Pattern(regexp = "[0-9]{6,8}")
                String code) {}
