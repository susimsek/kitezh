package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.SocialProviderMapperEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SocialProviderMapperRepository
        extends JpaRepository<SocialProviderMapperEntity, String> {

    String MAPPERS_BY_PROVIDER_ALIAS_CACHE = "socialProviderMappersByProviderAlias";

    Page<SocialProviderMapperEntity>
            findByProviderAliasAndNameContainingIgnoreCaseOrProviderAliasAndSourceClaimContainingIgnoreCase(
                    String providerAlias,
                    String name,
                    String providerAliasForClaim,
                    String sourceClaim,
                    Pageable pageable);

    boolean existsByProviderAliasAndNameIgnoreCase(String providerAlias, String name);

    @Cacheable(cacheNames = MAPPERS_BY_PROVIDER_ALIAS_CACHE, key = "#providerAlias")
    List<SocialProviderMapperEntity> findAllByProviderAliasIgnoreCase(String providerAlias);

    long countByProviderAlias(String providerAlias);

    @Query(
            "select m.providerAlias as alias, count(m) as count from SocialProviderMapperEntity m"
                    + " where m.providerAlias in :aliases group by m.providerAlias")
    List<MapperCount> countByProviderAliases(@Param("aliases") Collection<String> aliases);

    interface MapperCount {
        String getAlias();

        long getCount();
    }
}
