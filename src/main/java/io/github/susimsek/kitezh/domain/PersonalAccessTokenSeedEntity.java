package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@Entity
@Table(name = "personal_access_token_seeds")
public class PersonalAccessTokenSeedEntity {

    @Id
    @Column(name = "seed_key", nullable = false, length = 100)
    private String seedKey;

    @Column(name = "username", nullable = false, length = 100)
    private String username;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "expiration", nullable = false, length = 20)
    private String expiration;
}
