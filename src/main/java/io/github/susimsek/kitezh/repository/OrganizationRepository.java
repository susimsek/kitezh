package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationRepository extends JpaRepository<OrganizationEntity, Long> {

    Optional<OrganizationEntity> findByAliasIgnoreCase(String alias);

    boolean existsByAliasIgnoreCase(String alias);

    @Query(
            "select o from OrganizationEntity o where :query = ''"
                    + " or lower(o.alias) like lower(concat('%', :query, '%'))"
                    + " or lower(o.name) like lower(concat('%', :query, '%'))")
    Page<OrganizationEntity> search(@Param("query") String query, Pageable pageable);
}
