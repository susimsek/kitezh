package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.AuthenticationFlowRequirement;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminAuthenticationExecutionRequest",
        description = "Create or update a flow execution.")
public record AdminAuthenticationExecutionRequestDTO(
        @NotBlank
                @Size(max = 100)
                @Schema(
                        description = "Allow-listed authenticator provider identifier.",
                        example = "otp-form",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String providerId,
        @NotBlank
                @Size(max = 200)
                @Schema(
                        description = "Execution display name.",
                        example = "OTP Form",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String displayName,
        @NotNull
                @Schema(
                        description = "Execution requirement.",
                        example = "REQUIRED",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                AuthenticationFlowRequirement requirement,
        @Size(max = 100)
                @Schema(
                        description = "Optional authentication method reference for AMR claims.",
                        example = "otp",
                        nullable = true)
                String authenticatorReference,
        @Size(max = 4000)
                @Schema(
                        description = "Optional provider configuration JSON.",
                        example = "{\"issuer\":\"Kitezh\"}",
                        nullable = true,
                        format = "json")
                String configuration,
        @Min(0) @Schema(description = "Sibling order; lower values execute first.", example = "10")
                Integer priority) {}
