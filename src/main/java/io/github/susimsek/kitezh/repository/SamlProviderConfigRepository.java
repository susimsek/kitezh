package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.SamlProviderConfigEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SamlProviderConfigRepository
        extends JpaRepository<SamlProviderConfigEntity, String> {

    Optional<SamlProviderConfigEntity> findByProviderId(String providerId);

    List<SamlProviderConfigEntity> findAllByOrderByProviderIdAsc();
}
