package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.UserAction;
import io.github.susimsek.kitezh.domain.UserActionTokenEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import java.time.Instant;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AccountActionTokenMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "consumedAt", ignore = true)
    @Mapping(target = "user", source = "user")
    UserActionTokenEntity toEntity(
            UserEntity user,
            UserAction action,
            String email,
            String credentialFingerprint,
            String tokenHash,
            Instant issuedAt,
            Instant expiresAt);
}
