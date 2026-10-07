package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.EventListenerEventType;
import io.github.susimsek.kitezh.domain.EventListenerProviderType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.Set;

@Schema(name = "EventListenerProvider", description = "Configured event listener provider.")
public record EventListenerProviderDTO(
        @Schema(
                        description = "Provider identifier.",
                        example = "provider-1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Unique provider name.",
                        example = "security-webhook",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Provider implementation type.",
                        example = "WEBHOOK",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                EventListenerProviderType providerType,
        @Schema(
                        description = "HTTP endpoint receiving event payloads.",
                        example = "https://example.test/events",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String endpointUrl,
        @Schema(
                        description = "Whether delivery is enabled.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean enabled,
        @Schema(
                        description = "Maximum delivery attempts.",
                        example = "3",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int maxAttempts,
        @Schema(
                        description = "Delay between attempts in seconds.",
                        example = "30",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int backoffSeconds,
        @Schema(
                        description = "Event streams delivered by this provider.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<EventListenerEventType> eventTypes,
        @Schema(description = "Creation timestamp.", requiredMode = Schema.RequiredMode.REQUIRED)
                Instant createdAt,
        @Schema(description = "Last update timestamp.", requiredMode = Schema.RequiredMode.REQUIRED)
                Instant updatedAt) {}
