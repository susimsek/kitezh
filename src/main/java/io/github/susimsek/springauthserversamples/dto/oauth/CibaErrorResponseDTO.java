package io.github.susimsek.springauthserversamples.dto.oauth;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "OAuth 2.0 CIBA protocol error response.")
public record CibaErrorResponseDTO(
        @Schema(
                        description = "OAuth 2.0 error code.",
                        example = "invalid_request",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String error,
        @Schema(
                        description = "Human-readable error description.",
                        example = "login_hint is required",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @JsonProperty("error_description")
                String errorDescription) {}
