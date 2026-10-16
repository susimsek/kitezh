package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.DesktopSocialLinkTransactionEntity;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface DesktopSocialLinkTransactionRepository
        extends JpaRepository<DesktopSocialLinkTransactionEntity, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<DesktopSocialLinkTransactionEntity> findByAuthorizationTokenHash(
            String authorizationTokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<DesktopSocialLinkTransactionEntity> findByCompletionCodeHash(
            String completionCodeHash);
}
