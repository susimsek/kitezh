package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(
        name = "PersonalAccessTokenCreated",
        description = "New personal access token, returned once at creation.")
public record PersonalAccessTokenCreatedDTO(
        @Schema(description = "Token identifier.", example = "c7ac6c10-b73a-4ccb-83d3-e2df1f362d06")
                String id,
        @Schema(description = "User-provided token label.", example = "Codex on laptop")
                String name,
        @Schema(
                        description = "Optional user-provided token description.",
                        example = "Personal laptop",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String description,
        @Schema(
                        description = "The bearer token. It is returned only once.",
                        example = "eyJhbGciOiJSUzI1NiJ9...")
                String token,
        @Schema(description = "Granted read-only scope.", example = "mcp.read") String scope,
        @Schema(description = "Creation time.", format = "date-time") Instant createdAt,
        @Schema(
                        description = "Expiration time, or null when the token does not expire.",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Instant expiresAt) {}
