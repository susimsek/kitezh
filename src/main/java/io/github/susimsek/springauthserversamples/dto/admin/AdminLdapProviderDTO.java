package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "AdminLdapProvider", description = "LDAP or Active Directory federation provider.")
public record AdminLdapProviderDTO(
        @Schema(
                        description = "Provider identifier.",
                        example = "6c1a6a1c-2b0c-4a4d-8ac8-5f4ec0e1c79a",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Display name and stable provider key.",
                        example = "Corporate AD",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Whether this provider participates in login.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean enabled,
        @Schema(
                        description = "Provider order; lower values are tried first.",
                        example = "10",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int priority,
        @Schema(
                        description = "LDAP or LDAPS connection URL.",
                        example = "ldaps://ad.example.com:636",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String connectionUrl,
        @Schema(
                        description = "Service-account bind DN.",
                        example = "CN=svc-auth,OU=Service Accounts,DC=example,DC=com",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
                        nullable = true)
                String bindDn,
        @Schema(
                        description =
                                "Whether a bind password is stored; the password is never"
                                        + " returned.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean bindPasswordConfigured,
        @Schema(
                        description = "Base DN containing users.",
                        example = "OU=Users,DC=example,DC=com",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String usersDn,
        @Schema(
                        description = "LDAP attribute used for the login identifier.",
                        example = "sAMAccountName",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String usernameAttribute,
        @Schema(
                        description = "Stable LDAP entry identifier attribute.",
                        example = "objectGUID",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String uuidAttribute,
        @Schema(
                        description = "Email attribute.",
                        example = "mail",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String emailAttribute,
        @Schema(
                        description = "First-name attribute.",
                        example = "givenName",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String firstNameAttribute,
        @Schema(
                        description = "Last-name attribute.",
                        example = "sn",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String lastNameAttribute,
        @Schema(
                        description = "RDN attribute used for a user bind.",
                        example = "sAMAccountName",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String rdnAttribute,
        @Schema(
                        description = "Comma-separated LDAP object classes.",
                        example = "person, user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String objectClasses,
        @Schema(
                        description = "Search scope.",
                        allowableValues = {"OBJECT", "ONE_LEVEL", "SUBTREE"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String searchScope,
        @Schema(
                        description = "How imported users are maintained.",
                        allowableValues = {"READ_ONLY", "WRITABLE", "UNSYNCED"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String editMode,
        @Schema(
                        description = "Import a local user after successful LDAP authentication.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean importUsers,
        @Schema(
                        description = "Trust the directory email as verified.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean trustEmail,
        @Schema(description = "Create application registrations in LDAP.")
                boolean syncRegistrations,
        @Schema(description = "Periodic full synchronization interval in minutes.")
                int fullSyncIntervalMinutes,
        @Schema(description = "Periodic changed-user synchronization interval in minutes.")
                int changedSyncIntervalMinutes,
        @Schema(description = "Last synchronization time.", nullable = true) Instant lastSyncAt,
        @Schema(description = "Last synchronization status.", nullable = true)
                String lastSyncStatus,
        @Schema(description = "Last synchronization error.", nullable = true) String lastSyncError,
        @Schema(description = "Users imported by the last synchronization.") int lastSyncImported,
        @Schema(description = "Users updated by the last synchronization.") int lastSyncUpdated,
        @Schema(description = "Directory vendor profile.") String vendor,
        @Schema(description = "Bind authentication mechanism.") String authenticationType,
        @Schema(description = "Whether LDAP StartTLS is enabled.") boolean startTls,
        @Schema(description = "Configured truststore path.", nullable = true) String trustStorePath,
        @Schema(description = "Configured truststore type.") String trustStoreType,
        @Schema(description = "Whether JNDI connection pooling is enabled.")
                boolean connectionPooling,
        @Schema(description = "LDAP referral handling.") String referral,
        @Schema(description = "LDAP connect timeout in milliseconds.") int connectTimeoutMs,
        @Schema(description = "LDAP read timeout in milliseconds.") int readTimeoutMs,
        @Schema(description = "Synchronization page size.") int batchSize) {

    public AdminLdapProviderDTO(
            String id,
            String name,
            boolean enabled,
            int priority,
            String connectionUrl,
            String bindDn,
            boolean bindPasswordConfigured,
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
                bindPasswordConfigured,
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
                null,
                null,
                null,
                0,
                0,
                "LDAP",
                "SIMPLE",
                false,
                null,
                "JKS",
                false,
                "THROW",
                5000,
                5000,
                500);
    }
}
