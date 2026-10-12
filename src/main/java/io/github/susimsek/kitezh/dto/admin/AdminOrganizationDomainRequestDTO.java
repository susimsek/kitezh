package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminOrganizationDomainRequest", description = "Organization domain request.")
public record AdminOrganizationDomainRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 255, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "DNS domain.",
                        example = "acme.example.com",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String domain) {}
