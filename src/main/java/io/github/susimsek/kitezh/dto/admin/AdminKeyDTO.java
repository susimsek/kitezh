package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "AdminKey", description = "Authorization-server signing key summary.")
public record AdminKeyDTO(
        @Schema(
                        description = "Internal key identifier.",
                        example = "key-123",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Public key identifier.",
                        example = "rsa-20260904",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String kid,
        @Schema(
                        description = "JSON Web Key type.",
                        example = "RSA",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String type,
        @Schema(
                        description = "Signing algorithm.",
                        example = "RS256",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String algorithm,
        @Schema(
                        description = "Intended key use.",
                        example = "sig",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String use,
        @Schema(
                        description = "Whether this is the active signing key.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean active,
        @Schema(
                        description = "Key creation time.",
                        example = "2026-09-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant createdAt) {}
