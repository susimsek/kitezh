package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.PasswordHistoryEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import java.time.Instant;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface PasswordHistoryMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "user", source = "user")
    PasswordHistoryEntity toEntity(UserEntity user, String passwordHash, Instant createdAt);
}
