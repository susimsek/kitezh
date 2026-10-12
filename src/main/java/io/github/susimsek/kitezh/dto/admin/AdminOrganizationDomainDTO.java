package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "AdminOrganizationDomain", description = "An organization domain.")
public record AdminOrganizationDomainDTO(
        @Schema(description = "Domain identifier.", example = "1") Long id,
        @Schema(description = "DNS domain.", example = "acme.example.com") String domain,
        @Schema(description = "Whether the domain is verified.", example = "false")
                boolean verified,
        @Schema(description = "Verification token for DNS or HTTP verification.", nullable = true)
                String verificationToken,
        @Schema(description = "Verification time.", format = "date-time", nullable = true)
                Instant verifiedAt) {}
