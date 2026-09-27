package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminCibaPolicyRequest", description = "Updated CIBA policy.")
public record AdminCibaPolicyRequestDTO(
        @Schema(
                        description = "Default and maximum request lifetime in seconds.",
                        example = "300",
                        minimum = "30",
                        maximum = "3600",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @Min(value = 30, message = "{app.api.problem.violation.min}")
                @Max(value = 3600, message = "{app.api.problem.violation.max}")
                int requestLifespanSeconds,
        @Schema(
                        description = "Minimum interval between token polling attempts in seconds.",
                        example = "5",
                        minimum = "1",
                        maximum = "300",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @Min(value = 1, message = "{app.api.problem.violation.min}")
                @Max(value = 300, message = "{app.api.problem.violation.max}")
                int pollingIntervalSeconds,
        @Schema(
                        description = "Allowed delivery mode.",
                        example = "all",
                        allowableValues = {"all", "poll", "ping", "push"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @Pattern(
                        regexp = "all|poll|ping|push",
                        message = "{app.api.problem.violation.pattern}")
                @NotBlank(message = "{app.api.problem.violation.notBlank}")
                String deliveryMode,
        @Schema(
                        description = "User verification assurance requested before approval.",
                        example = "preferred",
                        allowableValues = {"required", "preferred", "discouraged"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @Pattern(
                        regexp = "required|preferred|discouraged",
                        message = "{app.api.problem.violation.pattern}")
                @NotBlank(message = "{app.api.problem.violation.notBlank}")
                String userVerification,
        @Schema(
                        description = "Require a verified MFA factor before approval.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean mfaRequired,
        @Schema(
                        description = "Require a recent step-up authentication before approval.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean stepUpRequired,
        @Schema(
                        description = "Optional assurance context required by the step-up policy.",
                        example = "urn:example:loa:2",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @Size(max = 100, message = "{app.api.problem.violation.size}")
                String stepUpAcr) {}
