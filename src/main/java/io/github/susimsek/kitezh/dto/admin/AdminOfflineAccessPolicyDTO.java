package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Duration;
import java.time.Instant;

@Schema(name = "AdminOfflineAccessPolicy", description = "Application-wide offline access policy.")
public record AdminOfflineAccessPolicyDTO(
        @Schema(
                        description = "Idle lifetime for offline sessions.",
                        example = "P30D",
                        format = "duration")
                Duration idleTimeout,
        @Schema(
                        description = "Absolute lifetime when max limiting is enabled.",
                        example = "P180D",
                        format = "duration",
                        nullable = true)
                Duration maxLifespan,
        @Schema(description = "Whether an absolute maximum lifetime is enforced.", example = "true")
                boolean maxLimited,
        @Schema(
                        description = "Tokens issued before this instant are revoked.",
                        format = "date-time",
                        nullable = true)
                Instant revokedBefore) {}
