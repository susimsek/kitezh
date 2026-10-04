package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.AccountProfileDTO;
import io.github.susimsek.kitezh.dto.account.AccountProfileRequestDTO;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AccountProfileMapper {

    AccountProfileDTO toDTO(UserEntity entity);

    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "firstName", source = "firstName", qualifiedByName = "trimToNull")
    @Mapping(target = "lastName", source = "lastName", qualifiedByName = "trimToNull")
    @Mapping(target = "email", source = "email", qualifiedByName = "normalizeEmail")
    void updateEntity(AccountProfileRequestDTO source, @MappingTarget UserEntity target);

    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "firstName", source = "firstName", qualifiedByName = "trimToNull")
    @Mapping(target = "lastName", source = "lastName", qualifiedByName = "trimToNull")
    void updateNames(AccountProfileRequestDTO source, @MappingTarget UserEntity target);

    default AccountProfileRequestDTO normalize(AccountProfileRequestDTO source) {
        return new AccountProfileRequestDTO(
                trimToNull(source.firstName()),
                trimToNull(source.lastName()),
                normalizeEmail(source.email()),
                trimToNull(source.currentPassword()));
    }

    @Named("trimToNull")
    default String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Named("normalizeEmail")
    default String normalizeEmail(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? null : normalized.toLowerCase(java.util.Locale.ROOT);
    }
}
