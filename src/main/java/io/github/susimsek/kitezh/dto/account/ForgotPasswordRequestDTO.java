package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "ForgotPasswordRequest", description = "Request to send a password reset email.")
public record ForgotPasswordRequestDTO(
        @Schema(
                        description = "Username or email address of the account.",
                        example = "user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 200)
                String identifier,
        @Schema(
                        description = "Optional BCP 47 email locale.",
                        example = "en",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @Size(max = 10)
                String locale) {}
