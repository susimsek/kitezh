package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.AuthenticationFlowRequirement;
import io.github.susimsek.kitezh.domain.AuthenticationFlowType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminAuthenticationFlowRequest",
        description = "Create or update an application authentication flow.")
public record AdminAuthenticationFlowRequestDTO(
        @NotBlank
                @Size(max = 100)
                @Pattern(regexp = "[a-z0-9][a-z0-9._-]*")
                @Schema(
                        description = "Unique application-wide flow alias.",
                        example = "browser-custom",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String alias,
        @NotBlank
                @Size(max = 200)
                @Schema(
                        description = "Flow display name.",
                        example = "Browser custom",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Size(max = 1000)
                @Schema(
                        description = "Optional administrator-facing flow description.",
                        example = "Single-issuer browser authentication flow.",
                        nullable = true)
                String description,
        @NotNull
                @Schema(
                        description = "Basic or form flow type.",
                        example = "BASIC",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                AuthenticationFlowType flowType,
        @Schema(
                        description =
                                "Requirement when creating a sub-flow; omitted for top-level"
                                        + " flows.",
                        example = "ALTERNATIVE",
                        nullable = true)
                AuthenticationFlowRequirement requirement,
        @Min(0) @Schema(description = "Sibling order; lower values execute first.", example = "10")
                Integer priority) {}
