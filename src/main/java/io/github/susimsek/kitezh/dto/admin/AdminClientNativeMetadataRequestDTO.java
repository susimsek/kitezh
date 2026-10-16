package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminClientNativeMetadataRequest",
        description = "Bounded client display-name update without OAuth configuration fields.")
public record AdminClientNativeMetadataRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 200, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Human-readable client name.",
                        example = "Reporting Client",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientName) {}
