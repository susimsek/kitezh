package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.AdminEventEntity;
import io.github.susimsek.kitezh.dto.admin.AdminEventDTO;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminEventMapper {

    AdminEventDTO toDTO(AdminEventEntity entity);

    AdminEventEntity toEntity(AdminEventData data);

    record AdminEventData(
            String id,
            String actor,
            String clientId,
            String ipAddress,
            String action,
            String targetType,
            String targetId,
            String details,
            java.time.Instant occurredAt) {}
}
