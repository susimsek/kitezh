package io.github.susimsek.springauthserversamples.mapper;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import java.util.Set;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AccountRegistrationMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "emailVerified", constant = "false")
    @Mapping(target = "enabled", constant = "true")
    @Mapping(target = "password", source = "encodedPassword")
    @Mapping(target = "pendingEmail", ignore = true)
    @Mapping(target = "pictureUrl", ignore = true)
    @Mapping(target = "groups", ignore = true)
    @Mapping(target = "clientRoles", ignore = true)
    @Mapping(target = "preferredLocale", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "lastModifiedBy", ignore = true)
    @Mapping(target = "passwordChangedAt", ignore = true)
    @Mapping(target = "mustChangePassword", ignore = true)
    @Mapping(target = "temporaryPassword", ignore = true)
    @Mapping(target = "failedLoginCount", ignore = true)
    @Mapping(target = "lastFailedLoginAt", ignore = true)
    @Mapping(target = "lockedUntil", ignore = true)
    @Mapping(target = "temporaryLockoutCount", ignore = true)
    @Mapping(target = "permanentlyLocked", ignore = true)
    @Mapping(target = "mfaFailedAttemptCount", ignore = true)
    @Mapping(target = "mfaPermanentlyLocked", ignore = true)
    @Mapping(target = "totpSecret", ignore = true)
    @Mapping(target = "totpEnabled", ignore = true)
    @Mapping(target = "totpLastUsedCounter", ignore = true)
    UserEntity toEntity(
            String username,
            String firstName,
            String lastName,
            String email,
            String encodedPassword,
            Set<AuthorityEntity> authorities);
}
