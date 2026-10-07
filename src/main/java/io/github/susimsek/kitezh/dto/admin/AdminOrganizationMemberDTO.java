package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.OrganizationMembershipType;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminOrganizationMember", description = "A user membership in an organization.")
public record AdminOrganizationMemberDTO(
        @Schema(
                        description = "Membership identifier.",
                        example = "1",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "User identifier.",
                        example = "2",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long userId,
        @Schema(
                        description = "Username.",
                        example = "alice",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String username,
        @Schema(
                        description = "Email address.",
                        example = "alice@example.com",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String email,
        @Schema(
                        description = "First name.",
                        example = "Alice",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String firstName,
        @Schema(
                        description = "Last name.",
                        example = "Smith",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String lastName,
        @Schema(
                        description = "Managed or unmanaged membership.",
                        example = "UNMANAGED",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                OrganizationMembershipType membershipType) {}
