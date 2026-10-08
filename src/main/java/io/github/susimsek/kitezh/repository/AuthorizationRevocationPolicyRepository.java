package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.AuthorizationRevocationPolicyEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorizationRevocationPolicyRepository
        extends JpaRepository<AuthorizationRevocationPolicyEntity, String> {}
