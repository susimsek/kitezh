package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.util.Locale;

@Schema(
        name = "AdminOrganizationInvitationRequest",
        description = "Organization invitation request.")
public record AdminOrganizationInvitationRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Email(message = "{app.api.problem.violation.email}")
                @Schema(
                        description = "Invitee email.",
                        example = "person@example.com",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String email,
        @Pattern(
                        regexp = "OWNER|ADMIN|MEMBER",
                        message = "{app.api.problem.organization.invalid_role}")
                @Schema(description = "Role granted on acceptance.", example = "MEMBER")
                String role,
        @Schema(
                        description = "Expiration time; defaults to seven days.",
                        format = "date-time",
                        nullable = true)
                Instant expiresAt) {

    public String roleValue() {
        return role == null || role.isBlank() ? "MEMBER" : role.trim().toUpperCase(Locale.ROOT);
    }
}
