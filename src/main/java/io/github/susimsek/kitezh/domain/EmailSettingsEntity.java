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
@Table(name = "email_settings")
public class EmailSettingsEntity {
    @Id private Long id;

    @Column(nullable = false)
    private boolean enabled;

    @Column(nullable = false, length = 255)
    private String fromAddress;

    @Column(nullable = false, length = 255)
    private String baseUrl;

    @Column(nullable = false, length = 255)
    private String host;

    @Column(nullable = false)
    private int port;

    @Column(length = 255)
    private String username;

    @Column(length = 1000)
    private String password;

    @Column(nullable = false)
    private boolean smtpAuth;

    @Column(nullable = false)
    private boolean starttls;

    @Column(nullable = false)
    private boolean ssl;
}
