package io.github.susimsek.springauthserversamples.dto.admin;

import io.github.susimsek.springauthserversamples.web.admin.validation.PositiveDuration;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;

@Schema(name = "AdminOfflineAccessPolicyRequest", description = "Offline access policy update.")
public record AdminOfflineAccessPolicyRequestDTO(
        @NotNull
                @PositiveDuration
                @Schema(
                        description = "Idle lifetime for offline sessions.",
                        example = "P30D",
                        format = "duration")
                Duration idleTimeout,
        @PositiveDuration
                @Schema(
                        description = "Absolute lifetime, or null to disable max limiting.",
                        example = "P180D",
                        format = "duration",
                        nullable = true)
                Duration maxLifespan,
        @Schema(description = "Whether an absolute maximum lifetime is enforced.", example = "true")
                boolean maxLimited) {}
