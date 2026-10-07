package io.github.susimsek.kitezh.domain;

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

/** Membership of an existing organization member in an organization group. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(
        name = "organization_group_members",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_organization_group_members_user",
                        columnNames = {"group_id", "user_id"}))
public class OrganizationGroupMemberEntity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "organization_group_member_seq")
    @SequenceGenerator(
            name = "organization_group_member_seq",
            sequenceName = "organization_group_member_seq",
            allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    private OrganizationGroupEntity group;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;
}
