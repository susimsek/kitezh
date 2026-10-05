package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.GroupPermissionEntity;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GroupPermissionRepository extends JpaRepository<GroupPermissionEntity, Long> {

    List<GroupPermissionEntity> findByGroupIdOrderByUserUsernameAscPermissionAsc(Long groupId);

    void deleteByGroupId(Long groupId);

    @Query(
            "select distinct p.group.id from GroupPermissionEntity p"
                    + " where p.user.id = :userId and p.permission in :permissions")
    Set<Long> findGroupIdsByUserIdAndPermissions(
            @Param("userId") Long userId, @Param("permissions") Collection<String> permissions);

    @Query(
            "select case when count(p) > 0 then true else false end from GroupPermissionEntity p"
                    + " where p.user.id = :userId and p.permission = :permission and p.group.id in"
                    + " :groupIds")
    boolean existsForUserAndGroups(
            @Param("userId") Long userId,
            @Param("groupIds") Collection<Long> groupIds,
            @Param("permission") String permission);
}
