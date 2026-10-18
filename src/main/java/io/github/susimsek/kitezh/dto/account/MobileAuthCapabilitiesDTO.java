package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(
        name = "MobileAuthCapabilities",
        description = "Versioned authentication capabilities supported by the mobile API.")
public record MobileAuthCapabilitiesDTO(
        @Schema(
                        description = "Version of this capability response contract.",
                        example = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int contractVersion,
        @Schema(
                        description =
                                "Stable capability identifiers supported by the current server."
                                    + " Provider configuration and user eligibility are reported by"
                                    + " their respective discovery or login responses.",
                        example = "[\"authorization_code_pkce\",\"native_password_login\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<String> capabilities) {}
