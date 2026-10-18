package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

@Schema(
        name = "MobilePasskeyOptions",
        description = "WebAuthn registration options for native enrollment.")
public record MobilePasskeyOptionsDTO(
        @Schema(
                        description = "Creation options for the native WebAuthn API.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Map<String, Object> publicKey) {}
