package io.github.susimsek.kitezh.dto.authz;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(description = "Resource registration submitted by an authenticated resource server.")
public record UmaResourceRegistrationRequestDTO(
        @Schema(
                        description = "Resource name.",
                        example = "Orders",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 200)
                String name,
        @Schema(description = "Optional resource type.", example = "order", nullable = true)
                @Size(max = 200)
                String type,
        @Schema(description = "Optional resource URI.", example = "/orders/*", nullable = true)
                @Size(max = 1000)
                String uri,
        @Schema(
                        description = "Supported operations.",
                        example = "[\"view\", \"edit\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotEmpty
                @Size(max = 50)
                List<@NotBlank @Size(max = 100) String> scopes) {}
