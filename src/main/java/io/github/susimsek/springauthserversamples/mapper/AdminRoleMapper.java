package io.github.susimsek.springauthserversamples.mapper;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleDetailDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleUserDTO;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import org.springframework.data.domain.Page;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminRoleMapper {

    @org.mapstruct.Mapping(target = "id", ignore = true)
    AuthorityEntity toEntity(String name, String description);

    default AuthorityEntity toEntity(String name) {
        return toEntity(name, null);
    }

    AdminRoleDTO toDTO(AuthorityEntity entity);

    AdminRoleUserDTO toUserDTO(UserEntity entity);

    default AdminRoleDetailDTO toDetailDTO(
            String name,
            String description,
            long userCount,
            boolean protectedRole,
            Page<AdminRoleUserDTO> users) {
        return new AdminRoleDetailDTO(name, description, userCount, protectedRole, users);
    }
}
