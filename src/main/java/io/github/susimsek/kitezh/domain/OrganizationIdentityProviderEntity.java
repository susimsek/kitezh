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

/** Binds an existing provider catalog entry to an organization. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(
        name = "organization_identity_providers",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_organization_identity_providers_provider",
                        columnNames = {"organization_id", "provider_alias"}))
public class OrganizationIdentityProviderEntity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "organization_idp_seq")
    @SequenceGenerator(
            name = "organization_idp_seq",
            sequenceName = "organization_idp_seq",
            allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private OrganizationEntity organization;

    @Column(name = "provider_alias", nullable = false, length = 50)
    private String providerAlias;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;
}
