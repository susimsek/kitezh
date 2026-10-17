package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.PersonalAccessTokenEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PersonalAccessTokenRepository
        extends JpaRepository<PersonalAccessTokenEntity, String> {

    List<PersonalAccessTokenEntity> findAllByUserUsernameOrderByCreatedAtDesc(String username);

    Optional<PersonalAccessTokenEntity> findByIdAndUserUsername(String id, String username);

    boolean existsBySeedKey(String seedKey);

    @Query(
            "select count(t) from PersonalAccessTokenEntity t where t.user.username = :username"
                    + " and (t.expiresAt is null or t.expiresAt > :now)")
    long countActiveByUsername(@Param("username") String username, @Param("now") Instant now);
}
