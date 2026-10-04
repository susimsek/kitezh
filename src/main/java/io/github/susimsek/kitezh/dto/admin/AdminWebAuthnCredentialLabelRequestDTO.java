package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminWebAuthnCredentialLabelRequest", description = "Passkey label update.")
public record AdminWebAuthnCredentialLabelRequestDTO(
        @Schema(description = "New administrator-visible passkey label.", example = "Office laptop")
                @NotBlank
                @Size(max = 100)
                String label) {}
