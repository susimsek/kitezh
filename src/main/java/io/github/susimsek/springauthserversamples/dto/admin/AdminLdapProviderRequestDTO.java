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
                boolean trustEmail) {}
