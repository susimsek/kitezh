package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.ClientScopeEntity;
import io.github.susimsek.kitezh.dto.admin.AdminClientScopeDTO;
import io.github.susimsek.kitezh.dto.admin.AdminScopeAssignmentsDTO;
import java.util.List;
import java.util.Set;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminClientScopeMapper {

    record MappingData(
            String id,
            String name,
            String displayName,
            String description,
            boolean displayOnConsentScreen,
            String consentScreenText,
            boolean includeInTokenScope,
            boolean groupMapperEnabled,
            String groupClaimName,
            boolean groupMapperFullPath) {}

    @Mapping(target = "id", source = "id")
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "name", source = "name")
    @Mapping(target = "displayName", source = "displayName")
    @Mapping(target = "description", source = "description")
    @Mapping(target = "builtIn", constant = "false")
    @Mapping(target = "displayOnConsentScreen", source = "displayOnConsentScreen")
    @Mapping(target = "consentScreenText", source = "consentScreenText")
    @Mapping(target = "includeInTokenScope", source = "includeInTokenScope")
    @Mapping(target = "groupMapperEnabled", source = "groupMapperEnabled")
    @Mapping(target = "groupClaimName", source = "groupClaimName")
    @Mapping(target = "groupMapperFullPath", source = "groupMapperFullPath")
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "lastModifiedBy", ignore = true)
    ClientScopeEntity toEntity(MappingData source);

    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "name", source = "name")
    @Mapping(target = "displayName", source = "displayName")
    @Mapping(target = "description", source = "description")
    @Mapping(target = "displayOnConsentScreen", source = "displayOnConsentScreen")
    @Mapping(target = "consentScreenText", source = "consentScreenText")
    @Mapping(target = "includeInTokenScope", source = "includeInTokenScope")
    @Mapping(target = "groupMapperEnabled", source = "groupMapperEnabled")
    @Mapping(target = "groupClaimName", source = "groupClaimName")
    @Mapping(target = "groupMapperFullPath", source = "groupMapperFullPath")
    void update(MappingData source, @MappingTarget ClientScopeEntity target);

    AdminClientScopeDTO toDTO(ClientScopeEntity entity);

    default AdminScopeAssignmentsDTO toAssignmentsDTO(
            Set<String> defaultScopes,
            Set<String> optionalScopes,
            List<AdminClientScopeDTO> availableScopes) {
        return new AdminScopeAssignmentsDTO(defaultScopes, optionalScopes, availableScopes);
    }
}
