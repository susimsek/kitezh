package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.UserAction;
import io.github.susimsek.kitezh.domain.UserActionTokenEntity;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserActionTokenRepository extends JpaRepository<UserActionTokenEntity, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<UserActionTokenEntity> findByTokenHash(String tokenHash);

    @Query("select t.user.id from UserActionTokenEntity t where t.tokenHash = :tokenHash")
    Optional<Long> findUserIdByTokenHash(String tokenHash);

    @Modifying
    @Query("delete from UserActionTokenEntity t where t.user.id = :userId")
    void deleteByUserId(Long userId);

    Optional<UserActionTokenEntity> findFirstByUserIdAndActionOrderByIssuedAtDesc(
            Long userId, UserAction action);

    @Modifying
    @Query(
            "delete from UserActionTokenEntity t where t.user.id = :userId and t.action = :action"
                    + " and t.consumedAt is null")
    void deleteActive(Long userId, UserAction action);
}
