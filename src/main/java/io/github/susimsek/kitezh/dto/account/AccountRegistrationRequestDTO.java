package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "AccountRegistrationRequest", description = "Public account registration request.")
public record AccountRegistrationRequestDTO(
        @NotBlank
                @Size(max = 100)
                @Schema(
                        description = "Unique login name.",
                        example = "new-user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String username,
        @NotBlank
                @Size(max = 100)
                @Schema(
                        description = "Given name.",
                        example = "Ada",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String firstName,
        @NotBlank
                @Size(max = 100)
                @Schema(
                        description = "Family name.",
                        example = "Lovelace",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String lastName,
        @NotBlank
                @Email
                @Size(max = 200)
                @Schema(
                        description = "Email address.",
                        example = "ada@example.test",
                        format = "email",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String email,
        @NotBlank
                @Size(min = 12, max = 128)
                @Schema(
                        description =
                                "Account password; must contain at least 12 characters and meet"
                                        + " the configured complexity rules.",
                        example = "Change-me12!",
                        format = "password",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String password,
        @NotBlank
                @Size(min = 12, max = 128)
                @Schema(
                        description = "Password confirmation; must match `password`.",
                        example = "Change-me12!",
                        format = "password",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String confirmPassword,
        @Size(max = 10000)
                @Schema(
                        description =
                                "Single-use reCAPTCHA or reCAPTCHA Enterprise response token."
                                        + " Required only when registration CAPTCHA is enabled.",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String captchaToken,
        @Size(max = 10)
                @Schema(
                        description = "Optional BCP 47 locale used for account emails.",
                        example = "en",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String locale,
        @Size(max = 256)
                @Schema(
                        description =
                                "Optional organization invitation token from an invitation email.",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String invitationToken) {}
