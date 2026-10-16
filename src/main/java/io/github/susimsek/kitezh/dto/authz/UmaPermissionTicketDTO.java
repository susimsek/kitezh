package io.github.susimsek.kitezh.dto.authz;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Opaque, short-lived UMA permission ticket.")
public record UmaPermissionTicketDTO(
        @Schema(
                        description = "Ticket to exchange at the OAuth token endpoint.",
                        example = "qgW0BMF-...",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String ticket,
        @Schema(
                        description = "Ticket expiry in seconds.",
                        example = "60",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @JsonProperty("expires_in")
                long expiresIn) {}
