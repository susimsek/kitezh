package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

@Schema(name = "AdminSocialProvidersRequest", description = "Social login provider updates.")
public record AdminSocialProvidersRequestDTO(
        @Schema(
                        description = "Provider credential updates.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotEmpty
                List<@Valid AdminSocialProviderRequestDTO> providers) {}
