package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminCibaPolicy",
        description = "Client-Initiated Backchannel Authentication policy.")
public record AdminCibaPolicyDTO(
        @Schema(
                        description = "Default and maximum request lifetime in seconds.",
                        example = "300",
                        minimum = "30",
                        maximum = "3600",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int requestLifespanSeconds,
        @Schema(
                        description = "Minimum interval between token polling attempts in seconds.",
                        example = "5",
                        minimum = "1",
                        maximum = "300",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int pollingIntervalSeconds,
        @Schema(
                        description =
                                "Allowed delivery mode. Use all to allow the mode registered by"
                                        + " each client.",
                        example = "all",
                        allowableValues = {"all", "poll", "ping", "push"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String deliveryMode,
        @Schema(
                        description = "User verification assurance requested before approval.",
                        example = "preferred",
                        allowableValues = {"required", "preferred", "discouraged"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String userVerification,
        @Schema(
                        description =
                                "Require a verified TOTP or recovery-code MFA factor before"
                                        + " approval.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean mfaRequired,
        @Schema(
                        description = "Require a recent step-up authentication before approval.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean stepUpRequired,
        @Schema(
                        description =
                                "Optional assurance context (ACR) required by the step-up policy.",
                        example = "urn:example:loa:2",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String stepUpAcr) {

    public static AdminCibaPolicyDTO defaults() {
        return new AdminCibaPolicyDTO(300, 5, "all", "preferred", false, false, null);
    }
}
