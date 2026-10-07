package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(name = "OrganizationDomainVerificationRequest")
public record OrganizationDomainVerificationRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Schema(
                        description = "Single-use domain verification token.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String token) {}
