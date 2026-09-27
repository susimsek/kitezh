package io.github.susimsek.springauthserversamples.mapper;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleUserDTO;
import java.util.Set;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import org.springframework.data.domain.Page;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminRoleMapper {

    @org.mapstruct.Mapping(target = "id", ignore = true)
    @org.mapstruct.Mapping(target = "compositeRoles", ignore = true)
    @org.mapstruct.Mapping(target = "compositeParents", ignore = true)
    @org.mapstruct.Mapping(target = "compositeClientRoles", ignore = true)
    AuthorityEntity toEntity(String name, String description);

    default AuthorityEntity toEntity(String name) {
        return toEntity(name, null);
    }

    AdminRoleDTO toDTO(AuthorityEntity entity);

    AdminRoleUserDTO toUserDTO(UserEntity entity);

    default io.github.susimsek.springauthserversamples.dto.admin.AdminRoleDetailDTO toDetailDTO(
            String name,
            String description,
            long userCount,
            boolean protectedRole,
            Page<AdminRoleUserDTO> users,
            Set<String> compositeRoles,
            Set<io.github.susimsek.springauthserversamples.dto.admin.AdminClientRoleDTO>
                    compositeClientRoles) {
        return new io.github.susimsek.springauthserversamples.dto.admin.AdminRoleDetailDTO(
                name,
                description,
                userCount,
                protectedRole,
                users,
                compositeRoles,
                compositeClientRoles);
    }

    default io.github.susimsek.springauthserversamples.dto.admin.AdminRoleDetailDTO toDetailDTO(
            String name,
            String description,
            long userCount,
            boolean protectedRole,
            Page<AdminRoleUserDTO> users) {
        return toDetailDTO(name, description, userCount, protectedRole, users, Set.of(), Set.of());
    }
}
