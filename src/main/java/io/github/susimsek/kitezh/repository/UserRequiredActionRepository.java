package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.UserRequiredActionEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

public interface UserRequiredActionRepository
        extends JpaRepository<UserRequiredActionEntity, Long> {

    List<UserRequiredActionEntity> findAllByUserId(Long userId);

    Optional<UserRequiredActionEntity> findByUserIdAndActionKey(Long userId, String actionKey);

    @Modifying
    void deleteByUserIdAndActionKey(Long userId, String actionKey);
}
