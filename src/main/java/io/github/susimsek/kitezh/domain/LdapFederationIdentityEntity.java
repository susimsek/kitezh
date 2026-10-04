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
import jakarta.persistence.ManyToOne;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.HashSet;
import java.util.Set;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Stable link between an LDAP entry and its imported local user. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(
        name = "ldap_federation_identities",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_ldap_federation_identity",
                        columnNames = {"provider_id", "external_id"}))
public class LdapFederationIdentityEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ldap_identity_seq")
    @SequenceGenerator(
            name = "ldap_identity_seq",
            sequenceName = "ldap_identity_seq",
            allocationSize = 1)
    private Long id;

    @Column(name = "external_id", nullable = false, length = 500)
    private String externalId;

    @Column(name = "distinguished_name", nullable = false, length = 2000)
    private String distinguishedName;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    private LdapFederationProviderEntity provider;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @ElementCollection
    @CollectionTable(
            name = "ldap_federation_identity_groups",
            joinColumns = @JoinColumn(name = "identity_id"))
    @Column(name = "group_name", nullable = false, length = 100)
    private Set<String> syncedGroupNames = new HashSet<>();

    @ElementCollection
    @CollectionTable(
            name = "ldap_federation_identity_roles",
            joinColumns = @JoinColumn(name = "identity_id"))
    @Column(name = "role_name", nullable = false, length = 200)
    private Set<String> syncedRoleNames = new HashSet<>();

    public LdapFederationIdentityEntity(
            String externalId,
            String distinguishedName,
            LdapFederationProviderEntity provider,
            UserEntity user) {
        this.externalId = externalId;
        this.distinguishedName = distinguishedName;
        this.provider = provider;
        this.user = user;
    }
}
