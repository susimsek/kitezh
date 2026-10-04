package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "AccountProfile", description = "Authenticated account profile.")
public record AccountProfileDTO(
        @Schema(
                        description = "Unique login name.",
                        example = "user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String username,
        @Schema(
                        description = "Given name.",
                        example = "Ada",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String firstName,
        @Schema(
                        description = "Family name.",
                        example = "Lovelace",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String lastName,
        @Schema(
                        description = "Email address.",
                        example = "ada@example.test",
                        format = "email",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String email,
        @Schema(
                        description = "Email address awaiting confirmation.",
                        example = "ada.new@example.test",
                        format = "email",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String pendingEmail,
        @Schema(
                        description = "Whether the email address has been verified.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean emailVerified,
        @Schema(
                        description =
                                "Persisted BCP 47 locale preference, or null to follow application"
                                        + " detection.",
                        example = "tr",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String preferredLocale,
        @Schema(
                        description = "Account creation time.",
                        example = "2026-09-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant createdAt,
        @Schema(
                        description = "Last account update time.",
                        example = "2026-09-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant updatedAt) {

    public AccountProfileDTO(
            String username,
            String firstName,
            String lastName,
            String email,
            Instant createdAt,
            Instant updatedAt) {
        this(username, firstName, lastName, email, null, false, null, createdAt, updatedAt);
    }
}
