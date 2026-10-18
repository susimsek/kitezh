package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;

@Schema(
        name = "MobilePasskeyRegistrationRequest",
        description = "Native WebAuthn credential registration response.")
public record MobilePasskeyRegistrationRequestDTO(
        @Schema(
                        description = "WebAuthn public-key credential attestation.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                Map<String, Object> credential,
        @Schema(description = "User-visible name for the new passkey.", example = "My phone")
                @NotBlank
                @Size(max = 100)
                String label) {}
