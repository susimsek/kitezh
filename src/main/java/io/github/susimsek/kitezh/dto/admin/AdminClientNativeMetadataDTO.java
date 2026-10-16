package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminClientNativeMetadata",
        description = "Native-safe client metadata without credentials or OAuth policy.")
public record AdminClientNativeMetadataDTO(
        @Schema(description = "Internal client identifier.", example = "client-123") String id,
        @Schema(description = "OAuth2 client identifier.", example = "reporting-client")
                String clientId,
        @Schema(description = "Human-readable client name.", example = "Reporting Client")
                String clientName) {}
