package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.OrganizationMembershipType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(name = "AdminOrganizationMemberRequest", description = "Organization membership request.")
public record AdminOrganizationMemberRequestDTO(
        @NotNull(message = "{app.api.problem.violation.required}")
                @Schema(
                        description = "User identifier.",
                        example = "2",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long userId,
        @Schema(
                        description = "Membership type.",
                        example = "UNMANAGED",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                OrganizationMembershipType membershipType) {

    public OrganizationMembershipType membershipTypeValue() {
        return membershipType == null ? OrganizationMembershipType.UNMANAGED : membershipType;
    }
}
