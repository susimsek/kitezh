package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.web.admin.validation.AbsoluteUri;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminEmailSettingsRequest",
        description = "Updated SMTP and outgoing email settings.")
public record AdminEmailSettingsRequestDTO(
        @Schema(description = "Enable outgoing email delivery.") boolean enabled,
        @Schema(
                        description = "Address used in the From header.",
                        format = "email",
                        example = "noreply@example.com")
                @NotBlank(message = "{app.api.problem.violation.required}")
                @Email(message = "{app.api.problem.violation.email}")
                @Size(max = 255, message = "{app.api.problem.violation.max_length}")
                String fromAddress,
        @Schema(
                        description = "Public application URL used in email links.",
                        format = "uri",
                        example = "https://example.com")
                @NotBlank(message = "{app.api.problem.violation.required}")
                @AbsoluteUri
                @Size(max = 255, message = "{app.api.problem.violation.max_length}")
                String baseUrl,
        @Schema(description = "SMTP server host name.", example = "smtp.example.com")
                @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 255, message = "{app.api.problem.violation.max_length}")
                String host,
        @Schema(description = "SMTP server port.", minimum = "1", maximum = "65535")
                @Min(1)
                @Max(65535)
                int port,
        @Schema(description = "SMTP username, if authentication is enabled.")
                @Size(max = 255, message = "{app.api.problem.violation.max_length}")
                String username,
        @Schema(
                        description = "SMTP password. Leave blank to retain the stored password.",
                        format = "password")
                @Size(max = 1000, message = "{app.api.problem.violation.max_length}")
                String password,
        @Schema(description = "Enable SMTP authentication.") boolean smtpAuth,
        @Schema(description = "Enable STARTTLS.") boolean starttls,
        @Schema(description = "Enable SSL/TLS socket transport.") boolean ssl) {}
