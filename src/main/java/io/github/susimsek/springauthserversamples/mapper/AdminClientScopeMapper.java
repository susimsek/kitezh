package io.github.susimsek.springauthserversamples.mapper;

import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientScopeDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminScopeAssignmentsDTO;
import java.util.List;
import java.util.Set;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminClientScopeMapper {

    @Mapping(target = "id", source = "id")
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "name", source = "name")
    @Mapping(target = "displayName", source = "displayName")
    @Mapping(target = "description", source = "description")
    @Mapping(target = "groupMapperEnabled", source = "groupMapperEnabled")
    @Mapping(target = "groupClaimName", source = "groupClaimName")
    @Mapping(target = "groupMapperFullPath", source = "groupMapperFullPath")
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "lastModifiedBy", ignore = true)
    ClientScopeEntity toEntity(
            String id,
            String name,
            String displayName,
            String description,
            boolean groupMapperEnabled,
            String groupClaimName,
            boolean groupMapperFullPath);

    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "name", source = "name")
    @Mapping(target = "displayName", source = "displayName")
    @Mapping(target = "description", source = "description")
    @Mapping(target = "groupMapperEnabled", source = "groupMapperEnabled")
    @Mapping(target = "groupClaimName", source = "groupClaimName")
    @Mapping(target = "groupMapperFullPath", source = "groupMapperFullPath")
    void update(
            String name,
            String displayName,
            String description,
            boolean groupMapperEnabled,
            String groupClaimName,
            boolean groupMapperFullPath,
            @MappingTarget ClientScopeEntity target);

    AdminClientScopeDTO toDTO(ClientScopeEntity entity);

    default AdminScopeAssignmentsDTO toAssignmentsDTO(
            Set<String> defaultScopes,
            Set<String> optionalScopes,
            List<AdminClientScopeDTO> availableScopes) {
        return new AdminScopeAssignmentsDTO(defaultScopes, optionalScopes, availableScopes);
    }
}
