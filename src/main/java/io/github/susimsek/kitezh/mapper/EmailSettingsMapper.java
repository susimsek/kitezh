package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.EmailSettingsEntity;
import io.github.susimsek.kitezh.dto.admin.AdminEmailSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.AdminEmailSettingsRequestDTO;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface EmailSettingsMapper {

    @Mapping(target = "passwordConfigured", expression = "java(passwordConfigured(source))")
    AdminEmailSettingsDTO toDTO(EmailSettingsEntity source);

    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "enabled", source = "enabled")
    @Mapping(target = "fromAddress", source = "fromAddress", qualifiedByName = "trim")
    @Mapping(target = "baseUrl", source = "baseUrl", qualifiedByName = "trim")
    @Mapping(target = "host", source = "host", qualifiedByName = "trim")
    @Mapping(target = "port", source = "port")
    @Mapping(target = "username", source = "username")
    @Mapping(target = "smtpAuth", source = "smtpAuth")
    @Mapping(target = "starttls", source = "starttls")
    @Mapping(target = "ssl", source = "ssl")
    void update(AdminEmailSettingsRequestDTO source, @MappingTarget EmailSettingsEntity target);

    default boolean passwordConfigured(EmailSettingsEntity source) {
        String password = source.getPassword();
        return password != null && !password.isBlank();
    }

    @Named("trim")
    default String trim(String value) {
        return value == null ? null : value.trim();
    }
}
