package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "AdminOrganizationMember", description = "Organization membership.")
public record AdminOrganizationMemberDTO(
        @Schema(description = "Membership identifier.", example = "1") Long id,
        @Schema(description = "User identifier.", example = "2") Long userId,
        @Schema(description = "Username.", example = "admin") String username,
        @Schema(description = "Email.", example = "admin@example.com", nullable = true)
                String email,
        @Schema(description = "Organization role.", example = "ADMIN") String role,
        @Schema(description = "Membership creation time.", format = "date-time")
                Instant joinedAt) {}
