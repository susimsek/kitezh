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

@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Getter
@Setter
@NoArgsConstructor
@Table(name = "localization_settings")
public class LocalizationSettingsEntity {

    @Id private Long id;

    @Column(name = "internationalization_enabled", nullable = false)
    private boolean internationalizationEnabled;

    @Column(name = "default_locale", nullable = false, length = 10)
    private String defaultLocale;

    @Column(name = "supported_locales", nullable = false, length = 500)
    private String supportedLocales;
}
