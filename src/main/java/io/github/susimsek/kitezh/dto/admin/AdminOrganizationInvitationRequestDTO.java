package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminOrganizationInvitationRequest", description = "Invitation create request.")
public record AdminOrganizationInvitationRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Email(message = "{app.api.problem.violation.email}")
                @Size(max = 200, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Invitee email.",
                        example = "alice@example.com",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String email,
        @Size(max = 200, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Optional invitee name.",
                        example = "Alice Smith",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String name,
        @Min(value = 1, message = "{app.api.problem.violation.min}")
                @Max(value = 168, message = "{app.api.problem.violation.max}")
                @Schema(
                        description = "Invitation lifetime in hours.",
                        example = "72",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Integer lifespanHours) {

    public int lifespanHoursValue() {
        return lifespanHours == null ? 72 : lifespanHours;
    }
}
