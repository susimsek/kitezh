package io.github.susimsek.kitezh.dto.userprofile;

import io.github.susimsek.kitezh.domain.UserProfileAttributeType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(
        name = "UserProfileAttributeDefinitionRequest",
        description = "User profile field configuration.")
public record UserProfileAttributeDefinitionRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 100, message = "{app.api.problem.violation.max100}")
                @Pattern(
                        regexp = "^[A-Za-z][A-Za-z0-9_.-]*$",
                        message = "{app.api.problem.user_profile.invalid_name}")
                @Schema(
                        description = "Stable attribute name.",
                        example = "department",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 200, message = "{app.api.problem.violation.max200}")
                @Schema(
                        description = "Display label.",
                        example = "Department",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String displayName,
        @Size(max = 1000, message = "{app.api.problem.violation.max1000}")
                @Schema(
                        description = "Optional help text.",
                        example = "The user's department.",
                        nullable = true)
                String description,
        @NotNull(message = "{app.api.problem.violation.required}")
                @Schema(
                        description = "Validation value type.",
                        example = "STRING",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                UserProfileAttributeType type,
        @Schema(description = "Whether at least one value is required.", example = "false")
                boolean required,
        @Schema(description = "Whether multiple values are allowed.", example = "false")
                boolean multivalued,
        @Min(value = 0, message = "{app.api.problem.violation.non_negative}")
                @Max(value = 2000, message = "{app.api.problem.violation.max2000}")
                @Schema(description = "Minimum value length.", example = "2", nullable = true)
                Integer minLength,
        @Min(value = 0, message = "{app.api.problem.violation.non_negative}")
                @Max(value = 2000, message = "{app.api.problem.violation.max2000}")
                @Schema(description = "Maximum value length.", example = "100", nullable = true)
                Integer maxLength,
        @Size(max = 500, message = "{app.api.problem.violation.max500}")
                @Schema(
                        description = "Optional Java regular expression.",
                        example = "^[A-Z].*$",
                        nullable = true)
                String pattern,
        @Schema(description = "Whether the definition is shown in profile forms.", example = "true")
                boolean enabled,
        @Min(value = 0, message = "{app.api.problem.violation.non_negative}")
                @Max(value = 10000, message = "{app.api.problem.violation.max10000}")
                @Schema(description = "Display order.", example = "10")
                int displayOrder) {}
