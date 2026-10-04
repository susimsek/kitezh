package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.RequiredActionCompletionEntity;
import io.github.susimsek.kitezh.domain.RequiredActionDefinitionEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.domain.UserRequiredActionEntity;
import io.github.susimsek.kitezh.dto.account.RequiredActionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRequiredActionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRequiredActionRequestDTO;
import java.time.Instant;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface RequiredActionMapper {

    default RequiredActionDTO toDTO(RequiredActionDefinitionEntity definition, long version) {
        return new RequiredActionDTO(
                definition.getActionKey(),
                definition.getDisplayName(),
                definition.getDescription(),
                version);
    }

    default AdminRequiredActionDTO toAdminDTO(RequiredActionDefinitionEntity definition) {
        return new AdminRequiredActionDTO(
                definition.getActionKey(),
                definition.getDisplayName(),
                definition.getDescription(),
                definition.isEnabled(),
                definition.isGlobalPolicy(),
                definition.getVersion(),
                definition.getPriority(),
                definition.getConfiguration());
    }

    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "actionKey", source = "actionKey")
    RequiredActionDefinitionEntity create(String actionKey);

    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "displayName", source = "displayName")
    @Mapping(target = "description", source = "description")
    @Mapping(target = "enabled", source = "enabled")
    @Mapping(target = "globalPolicy", source = "globalPolicy")
    @Mapping(target = "version", source = "version")
    @Mapping(target = "priority", source = "priority")
    @Mapping(target = "configuration", source = "configuration")
    void update(
            AdminRequiredActionRequestDTO source,
            @MappingTarget RequiredActionDefinitionEntity target);

    @Mapping(target = "id", ignore = true)
    UserRequiredActionEntity toAssignment(
            UserEntity user, String actionKey, long version, Instant assignedAt);

    @Mapping(target = "id", ignore = true)
    RequiredActionCompletionEntity toCompletion(
            UserEntity user,
            String actionKey,
            long version,
            Instant completedAt,
            String ipAddress,
            String userAgent);
}
