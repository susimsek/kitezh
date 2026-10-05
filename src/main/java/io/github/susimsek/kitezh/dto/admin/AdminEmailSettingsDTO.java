package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminEmailSettings", description = "SMTP and outgoing email settings.")
public record AdminEmailSettingsDTO(
        @Schema(description = "Enable outgoing email delivery.") boolean enabled,
        @Schema(description = "Address used in the From header.") String fromAddress,
        @Schema(description = "Public application URL used in email links.") String baseUrl,
        @Schema(description = "SMTP server host name.") String host,
        @Schema(description = "SMTP server port.", minimum = "1", maximum = "65535") int port,
        @Schema(description = "SMTP username, if authentication is enabled.") String username,
        @Schema(description = "Whether an SMTP password has been stored.")
                boolean passwordConfigured,
        @Schema(description = "Enable SMTP authentication.") boolean smtpAuth,
        @Schema(description = "Enable STARTTLS.") boolean starttls,
        @Schema(description = "Enable SSL/TLS socket transport.") boolean ssl) {}
