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

/** A permission granted to an administrator for a group and its descendants. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(
        name = "group_permissions",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_group_permissions_subject",
                        columnNames = {"group_id", "user_id", "permission"}))
public class GroupPermissionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "group_permission_seq")
    @SequenceGenerator(
            name = "group_permission_seq",
            sequenceName = "group_permission_seq",
            allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    private GroupEntity group;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "permission", nullable = false, length = 50)
    private String permission;

    public GroupPermissionEntity(GroupEntity group, UserEntity user, String permission) {
        this.group = group;
        this.user = user;
        this.permission = permission;
    }
}
