package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminLdapProviderRequest", description = "LDAP federation provider configuration.")
public record AdminLdapProviderRequestDTO(
        @Schema(
                        description = "Existing provider identifier; omit for a new provider.",
                        example = "6c1a6a1c-2b0c-4a4d-8ac8-5f4ec0e1c79a",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
                        nullable = true)
                String id,
        @Schema(
                        description = "Provider name.",
                        example = "Corporate AD",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String name,
        @Schema(
                        description = "Enable this provider.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean enabled,
        @Schema(
                        description = "Provider order.",
                        example = "10",
                        minimum = "0",
                        maximum = "10000",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @Min(0)
                @Max(10000)
                int priority,
        @Schema(
                        description = "LDAP or LDAPS URL.",
                        example = "ldaps://ad.example.com:636",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 1000)
                @Pattern(regexp = "(?i)ldaps?://[^\\s]+")
                String connectionUrl,
        @Schema(
                        description = "Service-account bind DN.",
                        example = "CN=svc-auth,OU=Service Accounts,DC=example,DC=com",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
                        nullable = true)
                @Size(max = 500)
                String bindDn,
        @Schema(
                        description = "New bind password; blank keeps the current password.",
                        example = "change-me",
                        writeOnly = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
                        nullable = true)
                @Size(max = 2000)
                String bindPassword,
        @Schema(description = "User search base DN.", requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 1000)
                String usersDn,
        @Schema(
                        description = "Login attribute.",
                        example = "sAMAccountName",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String usernameAttribute,
        @Schema(
                        description = "Stable entry identifier attribute.",
                        example = "objectGUID",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String uuidAttribute,
        @Schema(
                        description = "Email attribute.",
                        example = "mail",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String emailAttribute,
        @Schema(
                        description = "First-name attribute.",
                        example = "givenName",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String firstNameAttribute,
        @Schema(
                        description = "Last-name attribute.",
                        example = "sn",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String lastNameAttribute,
        @Schema(
                        description = "RDN attribute.",
                        example = "sAMAccountName",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String rdnAttribute,
        @Schema(
                        description = "Comma-separated object classes.",
                        example = "person,user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 1000)
                String objectClasses,
        @Schema(
                        description = "Search scope.",
                        allowableValues = {"OBJECT", "ONE_LEVEL", "SUBTREE"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                @Pattern(regexp = "OBJECT|ONE_LEVEL|SUBTREE")
                String searchScope,
        @Schema(
                        description = "Imported user edit mode.",
                        allowableValues = {"READ_ONLY", "WRITABLE", "UNSYNCED"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                @Pattern(regexp = "READ_ONLY|WRITABLE|UNSYNCED")
                String editMode,
        @Schema(
                        description = "Import a local user after successful login.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean importUsers,
        @Schema(
                        description = "Trust directory email as verified.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean trustEmail,
        @Schema(description = "Create application registrations in LDAP.")
                boolean syncRegistrations,
        @Min(0)
                @Max(525600)
                @Schema(description = "Periodic full synchronization interval in minutes.")
                int fullSyncIntervalMinutes,
        @Min(0)
                @Max(525600)
                @Schema(description = "Periodic changed-user synchronization interval in minutes.")
                int changedSyncIntervalMinutes,
        @Schema(
                        description = "Directory vendor profile.",
                        allowableValues = {"LDAP", "ACTIVE_DIRECTORY"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                @Pattern(regexp = "LDAP|ACTIVE_DIRECTORY")
                String vendor,
        @Schema(
                        description = "Bind authentication mechanism.",
                        allowableValues = {"SIMPLE", "KERBEROS"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                @Pattern(regexp = "SIMPLE|KERBEROS")
                String authenticationType,
        @Schema(description = "Use LDAP StartTLS on ldap:// connections.") boolean startTls,
        @Schema(
                        description =
                                "Truststore path used for LDAPS or StartTLS certificate"
                                        + " validation.",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
                        nullable = true)
                @Size(max = 1000)
                String trustStorePath,
        @Schema(
                        description = "Truststore password; blank keeps the current password.",
                        writeOnly = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
                        nullable = true)
                @Size(max = 2000)
                String trustStorePassword,
        @Schema(
                        description = "Truststore type.",
                        allowableValues = {"JKS", "PKCS12"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                @Pattern(regexp = "JKS|PKCS12")
                String trustStoreType,
        @Schema(description = "Enable the JNDI LDAP connection pool.") boolean connectionPooling,
        @Schema(
                        description = "LDAP referral handling.",
                        allowableValues = {"FOLLOW", "IGNORE", "THROW"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                @Pattern(regexp = "FOLLOW|IGNORE|THROW")
                String referral,
        @Schema(
                        description = "LDAP connect timeout in milliseconds.",
                        minimum = "100",
                        maximum = "600000")
                @Min(100)
                @Max(600000)
                int connectTimeoutMs,
        @Schema(
                        description = "LDAP read timeout in milliseconds.",
                        minimum = "100",
                        maximum = "600000")
                @Min(100)
                @Max(600000)
                int readTimeoutMs,
        @Schema(
                        description = "Maximum users returned by one synchronization page.",
                        minimum = "1",
                        maximum = "10000")
                @Min(1)
                @Max(10000)
                int batchSize) {

    public AdminLdapProviderRequestDTO(
            String id,
            String name,
            boolean enabled,
            int priority,
            String connectionUrl,
            String bindDn,
            String bindPassword,
            String usersDn,
            String usernameAttribute,
            String uuidAttribute,
            String emailAttribute,
            String firstNameAttribute,
            String lastNameAttribute,
            String rdnAttribute,
            String objectClasses,
            String searchScope,
            String editMode,
            boolean importUsers,
            boolean trustEmail) {
        this(
                id,
                name,
                enabled,
                priority,
                connectionUrl,
                bindDn,
                bindPassword,
                usersDn,
                usernameAttribute,
                uuidAttribute,
                emailAttribute,
                firstNameAttribute,
                lastNameAttribute,
                rdnAttribute,
                objectClasses,
                searchScope,
                editMode,
                importUsers,
                trustEmail,
                false,
                0,
                0,
                "LDAP",
                "SIMPLE",
                false,
                null,
                null,
                "JKS",
                false,
                "THROW",
                5000,
                5000,
                500);
    }
}
