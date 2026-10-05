package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
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
@Table(name = "localization_message_overrides")
public class LocalizationMessageOverrideEntity {

    @Id
    @GeneratedValue(
            strategy = GenerationType.SEQUENCE,
            generator = "localization_message_override_seq")
    @SequenceGenerator(
            name = "localization_message_override_seq",
            sequenceName = "localization_message_override_seq",
            allocationSize = 1)
    private Long id;

    @Column(name = "locale", nullable = false, length = 10)
    private String locale;

    @Column(name = "bundle", nullable = false, length = 50)
    private String bundle;

    @Column(name = "message_key", nullable = false, length = 255)
    private String messageKey;

    @Column(name = "message_value", nullable = false, length = 4000)
    private String messageValue;
}
