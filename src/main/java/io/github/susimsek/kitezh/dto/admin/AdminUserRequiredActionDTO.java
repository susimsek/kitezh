package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminUserRequiredAction", description = "Required action assignment for a user.")
public record AdminUserRequiredActionDTO(
        @Schema(
                        description = "Stable required-action key.",
                        example = "CONFIGURE_TOTP",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String key,
        @Schema(
                        description = "Display name shown to administrators.",
                        example = "Configure authenticator app",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String displayName,
        @Schema(
                        description = "Whether the policy is enabled.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean enabled,
        @Schema(
                        description = "Whether the action is controlled by a global policy.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean globalPolicy,
        @Schema(
                        description = "Whether the action applies to this user.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean assigned) {}
