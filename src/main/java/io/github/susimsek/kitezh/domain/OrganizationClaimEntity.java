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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "organization_claims")
public class OrganizationClaimEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "organization_claim_seq")
    @SequenceGenerator(
            name = "organization_claim_seq",
            sequenceName = "organization_claim_seq",
            allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private OrganizationEntity organization;

    @Column(name = "claim_name", nullable = false, length = 200)
    private String claimName;

    @Column(name = "claim_value", nullable = false, length = 2000)
    private String claimValue;

    @Column(name = "add_to_access_token", nullable = false)
    private boolean addToAccessToken = true;

    @Column(name = "add_to_id_token", nullable = false)
    private boolean addToIdToken;

    @Column(name = "add_to_user_info", nullable = false)
    private boolean addToUserInfo;
}
