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

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "organizations")
public class OrganizationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "organization_seq")
    @SequenceGenerator(
            name = "organization_seq",
            sequenceName = "organization_seq",
            allocationSize = 1)
    private Long id;

    @Column(name = "alias", nullable = false, unique = true, length = 100)
    private String alias;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "display_name", length = 200)
    private String displayName;

    @Column(name = "description", length = 2000)
    private String description;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;
}
