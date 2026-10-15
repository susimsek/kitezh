package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Reusable resource authorization policy.")
public record AdminAuthorizationPolicyDTO(
        @Schema(
                        description = "Policy identifier.",
                        example = "a5df36e9-3d4a-485d-ac6c-0fdbe7dc1601",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Owning resource-server client ID.",
                        example = "orders-api",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String resourceServerClientId,
        @Schema(
                        description = "Policy name.",
                        example = "Order owner",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Matcher type.",
                        example = "ROLE",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String type,
        @Schema(
                        description = "Matcher subject value.",
                        example = "ROLE_ORDER_EDITOR",
                        nullable = true)
                String subjectValue,
        @Schema(
                        description = "Effect on a match.",
                        example = "ALLOW",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String effect) {}
