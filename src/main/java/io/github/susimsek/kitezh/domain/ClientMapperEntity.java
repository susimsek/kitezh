package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(
        name = "oauth2_client_mapper",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_oauth2_client_mapper_client_name",
                        columnNames = {"client_id", "name"}))
public class ClientMapperEntity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "client_mapper_seq")
    @SequenceGenerator(
            name = "client_mapper_seq",
            sequenceName = "oauth2_client_mapper_seq",
            allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id", nullable = false)
    private RegisteredClientEntity client;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "mapper_type", nullable = false, length = 40)
    private String mapperType;

    @Column(name = "source", length = 200)
    private String source;

    @Column(name = "mapper_value", length = 1000)
    private String value;

    @Column(name = "claim_name", nullable = false, length = 200)
    private String claimName;

    @Column(name = "priority", nullable = false)
    private int priority = 100;

    @Column(name = "add_to_id_token", nullable = false)
    private boolean addToIdToken;

    @Column(name = "add_to_access_token", nullable = false)
    private boolean addToAccessToken = true;
}
