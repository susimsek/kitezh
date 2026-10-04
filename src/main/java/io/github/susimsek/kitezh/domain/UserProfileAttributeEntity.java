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

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(
        name = "user_profile_attributes",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_user_profile_attribute_position",
                        columnNames = {"user_id", "definition_id", "position"}))
public class UserProfileAttributeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "user_profile_attribute_seq")
    @SequenceGenerator(
            name = "user_profile_attribute_seq",
            sequenceName = "user_profile_attribute_seq",
            allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "definition_id", nullable = false)
    private UserProfileAttributeDefinitionEntity definition;

    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "attribute_value", nullable = false, length = 2000)
    private String value;

    public UserProfileAttributeEntity(
            UserEntity user,
            UserProfileAttributeDefinitionEntity definition,
            int position,
            String value) {
        this.user = user;
        this.definition = definition;
        this.position = position;
        this.value = value;
    }
}
