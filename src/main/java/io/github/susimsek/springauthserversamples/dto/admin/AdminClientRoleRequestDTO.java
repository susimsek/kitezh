package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminClientRoleRequest", description = "Client role create or update request.")
public record AdminClientRoleRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 100, message = "{app.api.problem.violation.max100}")
                @Pattern(
                        regexp = "[A-Za-z0-9._:-]+",
                        message = "{app.api.problem.violation.client_role_name}")
                @Schema(
                        description = "Role name within the client namespace.",
                        example = "invoice.read",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Size(max = 500, message = "{app.api.problem.violation.max500}")
                @Schema(
                        description = "Optional role description.",
                        example = "Read invoices.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String description) {}
