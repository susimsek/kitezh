package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminClientScopeRequest",
        description = "Client scope definition to create or update.")
public record AdminClientScopeRequestDTO(
        @Schema(
                        description = "Machine-readable scope name.",
                        example = "reporting-api",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String name,
        @Schema(
                        description = "Optional display name.",
                        example = "Reporting API",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @Size(max = 200)
                String displayName,
        @Schema(
                        description = "Optional scope description.",
                        example = "Read reporting data.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @Size(max = 500)
                String description,
        @Schema(
                        description = "Show this scope on the user consent screen.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean displayOnConsentScreen,
        @Schema(
                        description =
                                "Optional text displayed for this scope on the consent screen.",
                        example = "Access reporting data",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @Size(max = 200)
                String consentScreenText,
        @Schema(
                        description = "Include this scope in the issued token scope claim.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean includeInTokenScope,
        @Schema(
                        description = "Enable the allow-listed group membership mapper.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean groupMapperEnabled,
        @Schema(
                        description = "Claim name used for mapped groups.",
                        example = "groups",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @Size(max = 100)
                String groupClaimName,
        @Schema(
                        description = "Emit full hierarchical group paths.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean groupMapperFullPath) {

    public AdminClientScopeRequestDTO(String name, String displayName, String description) {
        this(name, displayName, description, false, null, true, false, "groups", true);
    }

    public AdminClientScopeRequestDTO(
            String name,
            String displayName,
            String description,
            Boolean groupMapperEnabled,
            String groupClaimName,
            Boolean groupMapperFullPath) {
        this(
                name,
                displayName,
                description,
                null,
                null,
                null,
                groupMapperEnabled,
                groupClaimName,
                groupMapperFullPath);
    }

    public boolean groupMapperEnabledValue() {
        return Boolean.TRUE.equals(groupMapperEnabled);
    }

    public boolean groupMapperEnabledValue(boolean fallback) {
        return groupMapperEnabled == null ? fallback : groupMapperEnabled;
    }

    public boolean groupMapperFullPathValue() {
        return groupMapperFullPath == null || groupMapperFullPath;
    }

    public boolean groupMapperFullPathValue(boolean fallback) {
        return groupMapperFullPath == null ? fallback : groupMapperFullPath;
    }

    public String groupClaimNameValue() {
        return groupClaimName == null || groupClaimName.isBlank()
                ? "groups"
                : groupClaimName.strip();
    }

    public String groupClaimNameValue(String fallback) {
        return groupClaimName == null || groupClaimName.isBlank()
                ? fallback
                : groupClaimName.strip();
    }

    public boolean displayOnConsentScreenValue() {
        return Boolean.TRUE.equals(displayOnConsentScreen);
    }

    public boolean displayOnConsentScreenValue(boolean fallback) {
        return displayOnConsentScreen == null ? fallback : displayOnConsentScreen;
    }

    public boolean includeInTokenScopeValue() {
        return includeInTokenScope == null || includeInTokenScope;
    }

    public boolean includeInTokenScopeValue(boolean fallback) {
        return includeInTokenScope == null ? fallback : includeInTokenScope;
    }

    public String consentScreenTextValue() {
        return consentScreenText == null || consentScreenText.isBlank()
                ? null
                : consentScreenText.strip();
    }

    public String consentScreenTextValue(String fallback) {
        return consentScreenText == null ? fallback : consentScreenTextValue();
    }
}
