package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
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
@Table(name = "user_profile_attribute_definitions")
public class UserProfileAttributeDefinitionEntity extends AuditableEntity {

    @Id
    @GeneratedValue(
            strategy = GenerationType.SEQUENCE,
            generator = "user_profile_attribute_definition_seq")
    @SequenceGenerator(
            name = "user_profile_attribute_definition_seq",
            sequenceName = "user_profile_attribute_definition_seq",
            allocationSize = 1)
    private Long id;

    @Column(name = "name", nullable = false, unique = true, length = 100)
    private String name;

    @Column(name = "display_name", nullable = false, length = 200)
    private String displayName;

    @Column(name = "description", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "attribute_type", nullable = false, length = 20)
    private UserProfileAttributeType type;

    @Column(name = "required", nullable = false)
    private boolean required;

    @Column(name = "multivalued", nullable = false)
    private boolean multivalued;

    @Column(name = "min_length")
    private Integer minLength;

    @Column(name = "max_length")
    private Integer maxLength;

    @Column(name = "pattern", length = 500)
    private String pattern;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;
}
