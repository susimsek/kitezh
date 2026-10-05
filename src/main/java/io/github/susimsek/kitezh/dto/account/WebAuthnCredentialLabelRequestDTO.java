package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "WebAuthnCredentialLabelRequest", description = "Updated passkey label.")
public record WebAuthnCredentialLabelRequestDTO(
        @Schema(
                        description = "Human-readable name for the passkey.",
                        example = "Windows Hello",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String label) {}
