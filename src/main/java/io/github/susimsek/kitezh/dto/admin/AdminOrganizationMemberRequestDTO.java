package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.Locale;

@Schema(name = "AdminOrganizationMemberRequest", description = "Organization membership request.")
public record AdminOrganizationMemberRequestDTO(
        @NotNull(message = "{app.api.problem.violation.required}")
                @Schema(
                        description = "User identifier.",
                        example = "2",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long userId,
        @Pattern(
                        regexp = "OWNER|ADMIN|MEMBER",
                        message = "{app.api.problem.organization.invalid_role}")
                @Schema(
                        description = "Membership role.",
                        example = "MEMBER",
                        allowableValues = {"OWNER", "ADMIN", "MEMBER"})
                String role) {

    public String roleValue() {
        return role == null || role.isBlank() ? "MEMBER" : role.trim().toUpperCase(Locale.ROOT);
    }
}
