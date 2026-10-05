package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;

@Schema(
        name = "AdminWhoAmI",
        description = "Current administrator identity and calculated console access flags.")
public record AdminWhoAmIDTO(
        @Schema(
                        description = "Authenticated administrator username.",
                        example = "admin",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String username,
        @Schema(
                        description = "Granted authorities.",
                        example = "[\"ROLE_ADMIN\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<String> authorities,
        @Schema(
                        description = "Access flags used by the administration console.",
                        example = "{\"viewUsers\":true,\"manageUsers\":true}",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Map<String, Boolean> access) {}
