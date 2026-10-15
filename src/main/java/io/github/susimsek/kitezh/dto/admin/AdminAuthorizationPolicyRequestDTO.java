package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "Reusable subject rule for resource permissions.")
public record AdminAuthorizationPolicyRequestDTO(
        @Schema(
                        description = "Owning resource-server client ID.",
                        example = "orders-api",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String resourceServerClientId,
        @Schema(
                        description = "Policy name.",
                        example = "Order owner",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 200)
                String name,
        @Schema(
                        description = "Subject matcher type.",
                        example = "ROLE",
                        allowableValues = {"USER", "ROLE", "GROUP", "CLIENT", "OWNER", "PUBLIC"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Pattern(regexp = "USER|ROLE|GROUP|CLIENT|OWNER|PUBLIC")
                String type,
        @Schema(
                        description = "Subject value; omitted for OWNER and PUBLIC.",
                        example = "ROLE_ORDER_EDITOR",
                        nullable = true)
                @Size(max = 200)
                String subjectValue,
        @Schema(
                        description = "Policy effect when the matcher succeeds.",
                        example = "ALLOW",
                        allowableValues = {"ALLOW", "DENY"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Pattern(regexp = "ALLOW|DENY")
                String effect) {}
