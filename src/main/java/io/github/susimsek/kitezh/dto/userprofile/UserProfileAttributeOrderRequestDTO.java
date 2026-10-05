package io.github.susimsek.kitezh.dto.userprofile;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(
        name = "UserProfileAttributeOrderRequest",
        description = "The profile attribute identifiers in their new display order.")
public record UserProfileAttributeOrderRequestDTO(
        @NotEmpty(message = "{app.api.problem.violation.required}")
                @Size(max = 100, message = "{app.api.problem.violation.max100}")
                @Schema(
                        description = "Profile attribute identifiers in display order.",
                        example = "[2, 1]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<@NotNull(message = "{app.api.problem.violation.required}") Long> ids) {}
