package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationMemberEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationMemberRepository
        extends JpaRepository<OrganizationMemberEntity, Long> {

    @EntityGraph(attributePaths = "user")
    @Query(
            "select m from OrganizationMemberEntity m join m.user u where m.organization.id ="
                + " :organizationId and (:query = '' or lower(u.username) like lower(concat('%',"
                + " :query, '%')) or lower(coalesce(u.email, '')) like lower(concat('%', :query,"
                + " '%')) or lower(coalesce(u.firstName, '')) like lower(concat('%', :query, '%'))"
                + " or lower(coalesce(u.lastName, '')) like lower(concat('%', :query, '%'))) ")
    Page<OrganizationMemberEntity> searchByOrganizationId(
            @Param("organizationId") Long organizationId,
            @Param("query") String query,
            Pageable pageable);

    boolean existsByOrganizationIdAndUserId(Long organizationId, Long userId);

    @EntityGraph(attributePaths = "user")
    Optional<OrganizationMemberEntity> findByOrganizationIdAndUserId(
            Long organizationId, Long userId);

    void deleteByOrganizationIdAndUserId(Long organizationId, Long userId);

    @EntityGraph(attributePaths = {"organization", "organization.attributes"})
    List<OrganizationMemberEntity> findByUserId(Long userId);
}
