package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(description = "Permission binding policies to a resource and optional scope.")
public record AdminAuthorizationPermissionRequestDTO(
        @Schema(
                        description = "Protected resource identifier.",
                        example = "6c6651a4-8b51-4aa9-8ddc-54694db9dafe",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 36)
                String resourceId,
        @Schema(
                        description = "Permission name.",
                        example = "Read orders",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 200)
                String name,
        @Schema(
                        description = "Scope name; null applies to all scopes on the resource.",
                        example = "view",
                        nullable = true)
                @Size(max = 100)
                String scopeName,
        @Schema(
                        description = "How linked policy results are combined.",
                        example = "AFFIRMATIVE",
                        allowableValues = {"AFFIRMATIVE", "UNANIMOUS", "CONSENSUS"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Pattern(regexp = "AFFIRMATIVE|UNANIMOUS|CONSENSUS")
                String decisionStrategy,
        @Schema(
                        description = "Policy identifiers evaluated for this permission.",
                        example = "[\"a5df36e9-3d4a-485d-ac6c-0fdbe7dc1601\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotEmpty
                @Size(max = 50)
                List<@NotBlank @Size(max = 36) String> policyIds) {}
