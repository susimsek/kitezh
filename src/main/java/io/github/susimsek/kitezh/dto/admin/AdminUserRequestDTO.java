package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.web.admin.validation.CreateValidation;
import io.github.susimsek.kitezh.web.admin.validation.OptionalPassword;
import io.github.susimsek.kitezh.web.admin.validation.PasswordChangeValidation;
import io.github.susimsek.kitezh.web.admin.validation.UpdateValidation;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Set;

@Schema(
        name = "AdminUserRequest",
        description = "User account fields used for create, update, or password change operations.")
public record AdminUserRequestDTO(
        @NotBlank(
                        groups = {CreateValidation.class, UpdateValidation.class},
                        message = "{app.api.problem.violation.required}")
                @Size(
                        max = 100,
                        groups = {CreateValidation.class, UpdateValidation.class})
                @Schema(
                        description = "Unique login name.",
                        example = "new-user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String username,
        @Size(
                        max = 100,
                        groups = {CreateValidation.class, UpdateValidation.class})
                @Schema(
                        description = "Given name.",
                        example = "Seto",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String firstName,
        @Size(
                        max = 100,
                        groups = {CreateValidation.class, UpdateValidation.class})
                @Schema(
                        description = "Family name.",
                        example = "Kaiba",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String lastName,
        @Email(groups = {CreateValidation.class, UpdateValidation.class})
                @Size(
                        max = 200,
                        groups = {CreateValidation.class, UpdateValidation.class})
                @Schema(
                        description = "Email address.",
                        example = "new-user@example.test",
                        format = "email",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String email,
        @Schema(
                        description = "Whether the email address is verified.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean emailVerified,
        @NotBlank(
                        groups = {CreateValidation.class, PasswordChangeValidation.class},
                        message = "{app.api.problem.violation.required}")
                @Size(
                        min = 12,
                        max = 128,
                        groups = {CreateValidation.class, PasswordChangeValidation.class},
                        message = "{app.api.problem.violation.password}")
                @OptionalPassword(groups = UpdateValidation.class)
                @Schema(
                        description =
                                "Initial or replacement password; at least 12 characters when"
                                        + " required.",
                        example = "Change-me12!",
                        format = "password",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String password,
        @Schema(
                        description =
                                "Whether an administrator-set password must be changed at next"
                                        + " sign-in.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean temporary,
        @NotNull(
                        groups = {CreateValidation.class, UpdateValidation.class},
                        message = "{app.api.problem.violation.required}")
                @Schema(
                        description = "Whether the account is enabled.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Boolean enabled,
        @NotEmpty(
                        groups = {CreateValidation.class, UpdateValidation.class},
                        message = "{app.api.problem.violation.roles}")
                @Schema(
                        description = "Realm roles assigned to the user.",
                        example = "[\"ROLE_USER\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<
                                @NotBlank(
                                        groups = {CreateValidation.class, UpdateValidation.class},
                                        message = "{app.api.problem.violation.roles}")
                                String>
                        roles) {

    public AdminUserRequestDTO(
            String username, String password, Boolean enabled, Set<String> roles) {
        this(username, null, null, null, false, password, null, enabled, roles);
    }
}
