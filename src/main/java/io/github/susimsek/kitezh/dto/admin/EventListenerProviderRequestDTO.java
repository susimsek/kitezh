package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.EventListenerEventType;
import io.github.susimsek.kitezh.domain.EventListenerProviderType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Set;

@Schema(
        name = "EventListenerProviderRequest",
        description = "Event listener provider configuration.")
public record EventListenerProviderRequestDTO(
        @NotBlank
                @Size(max = 100)
                @Schema(
                        description = "Unique provider name.",
                        example = "security-webhook",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @NotNull
                @Schema(
                        description = "Provider implementation type.",
                        example = "WEBHOOK",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                EventListenerProviderType providerType,
        @NotBlank
                @Size(max = 1000)
                @Schema(
                        description = "HTTP or HTTPS endpoint.",
                        example = "https://example.test/events",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String endpointUrl,
        @Schema(
                        description = "Whether delivery is enabled.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean enabled,
        @Min(1)
                @Max(10)
                @Schema(
                        description = "Maximum delivery attempts.",
                        example = "3",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int maxAttempts,
        @Min(1)
                @Max(86400)
                @Schema(
                        description = "Delay between attempts in seconds.",
                        example = "30",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int backoffSeconds,
        @NotEmpty
                @Schema(
                        description = "Event streams delivered by this provider.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<EventListenerEventType> eventTypes) {}
