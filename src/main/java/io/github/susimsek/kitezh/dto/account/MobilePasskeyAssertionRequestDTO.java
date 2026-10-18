package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

@Schema(
        name = "MobilePasskeyAssertionRequest",
        description = "Native WebAuthn assertion returned by the device authenticator.")
public record MobilePasskeyAssertionRequestDTO(
        @Schema(
                        description = "WebAuthn public-key credential assertion.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                Map<String, Object> credential) {}
