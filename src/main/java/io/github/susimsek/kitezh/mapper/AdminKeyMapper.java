package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.OAuth2KeyEntity;
import io.github.susimsek.kitezh.dto.admin.AdminKeyDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSigningKeySummaryDTO;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
@SuppressWarnings("java:S107")
public interface AdminKeyMapper {

    @org.mapstruct.Mapping(target = "createdAt", ignore = true)
    @org.mapstruct.Mapping(target = "updatedAt", ignore = true)
    @org.mapstruct.Mapping(target = "createdBy", ignore = true)
    @org.mapstruct.Mapping(target = "lastModifiedBy", ignore = true)
    OAuth2KeyEntity toEntity(
            String id,
            String kid,
            String type,
            String algorithm,
            String use,
            boolean active,
            String publicKey,
            String privateKey);

    AdminKeyDTO toDTO(OAuth2KeyEntity entity);

    AdminSigningKeySummaryDTO toSummaryDTO(OAuth2KeyEntity entity);
}
