package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.dto.admin.AdminDashboardDTO;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminDashboardMapper {

    AdminDashboardDTO toDTO(long clients, long users, long sessions, long consents);
}
