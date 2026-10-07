package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.EventListenerDeliveryStatus;
import io.github.susimsek.kitezh.domain.EventListenerEventType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "EventListenerDelivery", description = "Event listener delivery attempt history.")
public record EventListenerDeliveryDTO(
        @Schema(
                        description = "Delivery identifier.",
                        example = "delivery-1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Provider identifier, or null when the provider was deleted.",
                        example = "provider-1",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String providerId,
        @Schema(
                        description = "Published event identifier.",
                        example = "event-1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String eventId,
        @Schema(
                        description = "Published event stream.",
                        example = "USER_EVENT",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                EventListenerEventType eventType,
        @Schema(
                        description = "Delivery status.",
                        example = "SUCCEEDED",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                EventListenerDeliveryStatus status,
        @Schema(
                        description = "Number of attempts.",
                        example = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int attempts,
        @Schema(description = "Next retry timestamp.", nullable = true) Instant nextAttemptAt,
        @Schema(description = "Last delivery error.", nullable = true) String lastError,
        @Schema(description = "Creation timestamp.", requiredMode = Schema.RequiredMode.REQUIRED)
                Instant createdAt,
        @Schema(description = "Completion timestamp.", nullable = true) Instant completedAt) {}
