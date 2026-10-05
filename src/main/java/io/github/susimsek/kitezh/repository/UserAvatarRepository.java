package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.UserAvatarEntity;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserAvatarRepository extends JpaRepository<UserAvatarEntity, Long> {

    Optional<UserAvatarEntity> findByPublicId(String publicId);

    @Query(
            "select avatar.userId as userId, avatar.publicId as publicId, avatar.updatedAt as"
                    + " updatedAt from UserAvatarEntity avatar where avatar.userId = :userId")
    Optional<AvatarVersion> findVersionByUserId(Long userId);

    @Query(
            "select avatar.userId as userId, avatar.publicId as publicId, avatar.updatedAt as"
                    + " updatedAt from UserAvatarEntity avatar where avatar.userId in :userIds")
    List<AvatarVersion> findVersionsByUserIdIn(Collection<Long> userIds);

    interface AvatarVersion {
        Long getUserId();

        String getPublicId();

        Instant getUpdatedAt();
    }
}
