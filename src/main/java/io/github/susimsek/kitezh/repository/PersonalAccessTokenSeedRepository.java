package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.PersonalAccessTokenSeedEntity;
import jakarta.persistence.LockModeType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface PersonalAccessTokenSeedRepository
        extends JpaRepository<PersonalAccessTokenSeedEntity, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select seed from PersonalAccessTokenSeedEntity seed order by seed.seedKey")
    List<PersonalAccessTokenSeedEntity> findAllForUpdate();
}
