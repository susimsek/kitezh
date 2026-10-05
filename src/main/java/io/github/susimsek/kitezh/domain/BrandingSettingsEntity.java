package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/** Global branding settings shared by the login and console applications. */
@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Getter
@Setter
@NoArgsConstructor
@Table(name = "branding_settings")
public class BrandingSettingsEntity {

    @Id private Long id;

    @Column(name = "application_name", nullable = false, length = 100)
    private String applicationName;

    @Column(name = "logo_path", nullable = false, length = 255)
    private String logoPath;

    @Column(name = "favicon_path", nullable = false, length = 255)
    private String faviconPath;

    @Column(name = "apple_touch_icon_path", nullable = false, length = 255)
    private String appleTouchIconPath;

    @Column(name = "primary_color", nullable = false, length = 7)
    private String primaryColor;

    @Column(name = "accent_color", nullable = false, length = 7)
    private String accentColor;

    @Column(name = "background_color", nullable = false, length = 7)
    private String backgroundColor;
}
