package io.github.susimsek.springauthserversamples.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

/** Provider-scoped LDAP mapper configuration. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(
        name = "ldap_federation_mappers",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_ldap_federation_mapper_name",
                        columnNames = {"provider_id", "name"}))
public class LdapFederationMapperEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ldap_mapper_seq")
    @SequenceGenerator(
            name = "ldap_mapper_seq",
            sequenceName = "ldap_mapper_seq",
            allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    private LdapFederationProviderEntity provider;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "mapper_type", nullable = false, length = 40)
    private LdapFederationMapperType type;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "ldap_attribute", length = 100)
    private String ldapAttribute;

    @Column(name = "user_attribute", length = 100)
    private String userAttribute;

    @Column(name = "hardcoded_value", length = 2000)
    private String hardcodedValue;

    @Column(name = "target_name", length = 200)
    private String targetName;

    @Column(name = "group_search_base", length = 1000)
    private String groupSearchBase;

    @Column(name = "group_object_class", length = 100)
    private String groupObjectClass = "groupOfNames";

    @Column(name = "group_name_attribute", length = 100)
    private String groupNameAttribute = "cn";

    @Column(name = "group_member_attribute", length = 100)
    private String groupMemberAttribute = "member";
}
