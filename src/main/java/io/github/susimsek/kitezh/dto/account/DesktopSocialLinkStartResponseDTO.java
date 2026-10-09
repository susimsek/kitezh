package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "Native desktop social-link browser handoff.")
public record DesktopSocialLinkStartResponseDTO(
        @Schema(
                        description = "Short-lived browser authorization URL.",
                        example =
                                "https://localhost:9090/account/social-links/google/desktop/authorize",
                        format = "uri",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String authorizationUrl,
        @Schema(
                        description = "The state value that must return to the native callback.",
                        example = "native-state-value",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String state,
        @Schema(
                        description = "Transaction expiry time.",
                        example = "2030-01-01T00:00:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant expiresAt) {}
