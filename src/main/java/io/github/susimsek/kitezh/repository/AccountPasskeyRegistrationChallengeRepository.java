package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.AccountPasskeyRegistrationChallengeEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountPasskeyRegistrationChallengeRepository
        extends JpaRepository<AccountPasskeyRegistrationChallengeEntity, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "select challenge from AccountPasskeyRegistrationChallengeEntity challenge where"
                    + " challenge.id = :id")
    AccountPasskeyRegistrationChallengeEntity findByIdForUpdate(@Param("id") String id);

    @Modifying
    @Query(
            "delete from AccountPasskeyRegistrationChallengeEntity challenge where"
                    + " challenge.expiresAt < :now")
    int deleteExpired(@Param("now") java.time.Instant now);
}
