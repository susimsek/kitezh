package io.github.susimsek.kitezh.dto.userprofile;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;

@Schema(
        name = "UserProfileAttributesRequest",
        description = "Values for configurable user profile fields.")
public record UserProfileAttributesRequestDTO(
        @NotNull(message = "{app.api.problem.violation.required}")
                @Schema(
                        description = "Values keyed by stable attribute name.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Map<String, List<String>> attributes) {}
