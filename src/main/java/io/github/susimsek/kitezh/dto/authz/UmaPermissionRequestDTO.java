package io.github.susimsek.kitezh.dto.authz;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(description = "UMA permission requested by a resource server.")
public record UmaPermissionRequestDTO(
        @Schema(
                        description = "Protected resource identifier.",
                        example = "6c6651a4-8b51-4aa9-8ddc-54694db9dafe",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 36)
                String resourceId,
        @Schema(
                        description = "Requested resource operations.",
                        example = "[\"view\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotEmpty
                @Size(max = 20)
                List<@NotBlank @Size(max = 100) String> scopes) {}
