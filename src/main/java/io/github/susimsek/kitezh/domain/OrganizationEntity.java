package io.github.susimsek.kitezh.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.util.HashSet;
import java.util.Set;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/** A B2B organization within the sample's single issuer. */
@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Getter
@Setter
@NoArgsConstructor
@Table(name = "organizations")
public class OrganizationEntity extends AuditableEntity {

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

    @Column(name = "redirect_url", length = 1000)
    private String redirectUrl;

    @Column(name = "description", length = 2000)
    private String description;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @ElementCollection(fetch = FetchType.EAGER)
    @Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
    @CollectionTable(
            name = "organization_attributes",
            joinColumns = @JoinColumn(name = "organization_id"))
    private Set<OrganizationAttribute> attributes = new HashSet<>();
}
