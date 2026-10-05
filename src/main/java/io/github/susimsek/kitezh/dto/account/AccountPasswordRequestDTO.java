package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AccountPasswordRequest",
        description = "Password change request for the authenticated account.")
public record AccountPasswordRequestDTO(
        @Schema(
                        description = "The account's current password.",
                        example = "current-password",
                        format = "password",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 200)
                String currentPassword,
        @Schema(
                        description =
                                "The new password; must contain at least 12 characters and"
                                        + " complexity rules.",
                        example = "Change-me12!",
                        format = "password",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(min = 12, max = 128)
                String newPassword) {}
