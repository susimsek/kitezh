package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.dto.account.BrandingSettingsDTO;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminBrandingSettings", description = "Application branding settings.")
public record AdminBrandingSettingsDTO(
        @Schema(description = "Application name displayed in the public and console headers.")
                String applicationName,
        @Schema(description = "Public path of the shared application logo.") String logoPath,
        @Schema(description = "Public path of the browser favicon.") String faviconPath,
        @Schema(description = "Public path of the Apple touch icon.") String appleTouchIconPath,
        @Schema(description = "Primary brand color in #RRGGBB format.", example = "#0d6efd")
                String primaryColor,
        @Schema(description = "Accent brand color in #RRGGBB format.", example = "#0b2b69")
                String accentColor,
        @Schema(
                        description = "Application background color in #RRGGBB format.",
                        example = "#f8f9fa")
                String backgroundColor) {

    public BrandingSettingsDTO toPublic() {
        return new BrandingSettingsDTO(
                applicationName,
                logoPath,
                faviconPath,
                appleTouchIconPath,
                primaryColor,
                accentColor,
                backgroundColor);
    }
}
