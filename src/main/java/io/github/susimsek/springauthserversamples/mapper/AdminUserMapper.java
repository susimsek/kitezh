package io.github.susimsek.springauthserversamples.mapper;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminUserDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminUserGroupRoleDTO;
import io.github.susimsek.springauthserversamples.service.security.EffectiveRoleService;
import java.util.Set;
import org.mapstruct.Context;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
@SuppressWarnings("java:S107")
public interface AdminUserMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "firstName", source = "firstName")
    @Mapping(target = "lastName", source = "lastName")
    @Mapping(target = "email", source = "normalizedEmail")
    @Mapping(target = "password", source = "encodedPassword")
    @Mapping(target = "pendingEmail", ignore = true)
    @Mapping(target = "pictureUrl", ignore = true)
    @Mapping(target = "authorities", source = "resolvedAuthorities")
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
    @Mapping(
            target = "emailVerified",
            expression = "java(normalizedEmail != null && emailVerified)")
    UserEntity toEntity(
            String username,
            String firstName,
            String lastName,
            String normalizedEmail,
            boolean emailVerified,
            boolean enabled,
            String encodedPassword,
            Set<AuthorityEntity> resolvedAuthorities);

    default AdminUserDTO toDTO(UserEntity entity, @Context String avatarUrl) {
        EffectiveRoleService.EffectiveRoles roleView = EffectiveRoleService.resolve(entity);
        return new AdminUserDTO(
                entity.getId(),
                entity.getUsername(),
                entity.getFirstName(),
                entity.getLastName(),
                entity.getEmail(),
                entity.isEmailVerified(),
                entity.isEnabled(),
                entity.isPermanentlyLocked()
                        || entity.isMfaPermanentlyLocked()
                        || (entity.getLockedUntil() != null
                                && entity.getLockedUntil().isAfter(java.time.Instant.now())),
                entity.getLockedUntil(),
                entity.getFailedLoginCount(),
                entity.isMustChangePassword(),
                entity.isTemporaryPassword(),
                entity.isTotpEnabled(),
                avatarUrl,
                roleView.assignedRoles(),
                roleView.assignedRoles(),
                roleView.groupMappings().stream()
                        .map(
                                mapping ->
                                        new AdminUserGroupRoleDTO(
                                                mapping.groupId(),
                                                mapping.groupPath(),
                                                mapping.roles()))
                        .toList(),
                roleView.inheritedRoles(),
                roleView.effectiveRoles(),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "firstName", source = "firstName")
    @Mapping(target = "lastName", source = "lastName")
    @Mapping(target = "email", source = "normalizedEmail")
    @Mapping(target = "password", source = "encodedPassword")
    @Mapping(target = "pendingEmail", ignore = true)
    @Mapping(target = "pictureUrl", ignore = true)
    @Mapping(target = "authorities", source = "resolvedAuthorities")
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
    @Mapping(
            target = "emailVerified",
            expression = "java(normalizedEmail != null && emailVerified)")
    void update(
            String username,
            String firstName,
            String lastName,
            String normalizedEmail,
            boolean emailVerified,
            boolean enabled,
            String encodedPassword,
            Set<AuthorityEntity> resolvedAuthorities,
            @org.mapstruct.MappingTarget UserEntity target);

    default void updateAuthorities(Set<AuthorityEntity> resolvedAuthorities, UserEntity target) {
        target.setAuthorities(resolvedAuthorities);
    }

    default void updateEnabled(boolean enabled, UserEntity target) {
        target.setEnabled(enabled);
    }

    default Set<String> authorities(UserEntity entity) {
        return EffectiveRoleService.resolve(entity).assignedRoles();
    }
}
