package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.dto.admin.AdminImpersonationDTO;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminImpersonationMapper {

    default AdminImpersonationDTO toDTO(String url, String username, String ticket) {
        return new AdminImpersonationDTO(url, username, ticket);
    }
}
