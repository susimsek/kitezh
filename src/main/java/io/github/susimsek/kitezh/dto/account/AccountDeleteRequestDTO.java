package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "AccountDeleteRequest", description = "Confirmation required to delete an account.")
public record AccountDeleteRequestDTO(
        @NotBlank
                @Size(max = 200, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "The current account password used to confirm deletion.",
                        example = "current-password",
                        format = "password",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String currentPassword) {}
