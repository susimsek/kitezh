package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.GroupEntity;
import io.github.susimsek.kitezh.domain.UserAction;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminGroupDTO;
import io.github.susimsek.kitezh.dto.admin.AdminUserBulkAction;
import io.github.susimsek.kitezh.dto.admin.AdminUserBulkOperationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminUserDTO;
import io.github.susimsek.kitezh.mapper.AdminGroupMapper;
import io.github.susimsek.kitezh.mapper.AdminUserMapper;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.GroupRepository;
import io.github.susimsek.kitezh.repository.RecoveryCodeRepository;
import io.github.susimsek.kitezh.repository.UserAvatarRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.LdapFederationWriteService;
import io.github.susimsek.kitezh.service.account.UserActionService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.AccountLockService;
import io.github.susimsek.kitezh.service.security.EffectiveRoleService;
import io.github.susimsek.kitezh.service.security.PasswordService;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@SuppressWarnings("java:S107")
public class AdminUserService {

    private static final String USERNAME_FIELD = "username";
    private static final String USER_ENABLED_UPDATED_EVENT = "user.enabled.updated";

    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final UserAvatarRepository userAvatarRepository;
    private final AuthorityRepository authorityRepository;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final AccountLockService accountLockService;
    private final PasswordService passwordService;
    private final AdminAuditEventService adminAuditEventService;
    private final UserActionService userActionService;
    private final AdminUserMapper adminUserMapper;
    private final AdminGroupMapper adminGroupMapper;
    private final RecoveryCodeRepository recoveryCodeRepository;
    private final LdapFederationWriteService ldapFederationWriteService;

    @Transactional(readOnly = true)
    public AdminUserDTO user(Long id, String currentUsername) {
        UserEntity user = findUser(id);
        assertCanManageUser(user, currentUsername);
        return userView(user, avatarUrl(user.getId()));
    }

    @Transactional(readOnly = true)
    public String currentAvatarUrl(String username) {
        return userRepository
                .findByUsername(username)
                .map(user -> userView(user, avatarUrl(user.getId())).avatarUrl())
                .orElse(null);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminUserDTO createUser(
            String username,
            String password,
            boolean enabled,
            Set<String> roles,
            String currentUsername) {
        return createUserInternal(
                username,
                null,
                null,
                null,
                false,
                password,
                false,
                enabled,
                roles,
                currentUsername);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminUserDTO createUser(
            String username,
            String email,
            boolean emailVerified,
            String password,
            boolean enabled,
            Set<String> roles,
            String currentUsername) {
        return createUserInternal(
                username,
                null,
                null,
                email,
                emailVerified,
                password,
                false,
                enabled,
                roles,
                currentUsername);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminUserDTO createUser(
            String username,
            String firstName,
            String lastName,
            String email,
            boolean emailVerified,
            String password,
            boolean enabled,
            Set<String> roles,
            String currentUsername) {
        return createUserInternal(
                username,
                firstName,
                lastName,
                email,
                emailVerified,
                password,
                false,
                enabled,
                roles,
                currentUsername);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminUserDTO createUser(
            String username,
            String firstName,
            String lastName,
            String email,
            boolean emailVerified,
            String password,
            boolean temporary,
            boolean enabled,
            Set<String> roles,
            String currentUsername) {
        return createUserInternal(
                username,
                firstName,
                lastName,
                email,
                emailVerified,
                password,
                temporary,
                enabled,
                roles,
                currentUsername);
    }

    private AdminUserDTO createUserInternal(
            String username,
            String firstName,
            String lastName,
            String email,
            boolean emailVerified,
            String password,
            boolean temporary,
            boolean enabled,
            Set<String> roles,
            String currentUsername) {
        validateUser(username, password);
        firstName = normalizeName(firstName);
        lastName = normalizeName(lastName);
        String normalizedEmail = normalizeEmail(email);
        assertEmailAvailable(normalizedEmail, null);
        assertRoleAssignmentAllowed(roles, currentUsername);
        if (userRepository.findByUsername(username).isPresent()) {
            throw ApiException.conflict(
                    USERNAME_FIELD,
                    ApiErrorCode.USER_DUPLICATE_USERNAME,
                    "Username is already registered");
        }
        UserEntity user =
                adminUserMapper.toEntity(
                        username,
                        firstName,
                        lastName,
                        normalizedEmail,
                        emailVerified,
                        enabled,
                        null,
                        resolveAuthorities(roles));
        if (temporary) {
            passwordService.setTemporaryPassword(user, password);
        } else {
            passwordService.setInitialPassword(user, password);
        }
        List<GroupEntity> defaultGroups = groupRepository.findByDefaultGroupTrueOrderByNameAsc();
        if (defaultGroups != null) {
            user.getGroups().addAll(defaultGroups);
        }
        UserEntity saved = userRepository.save(user);
        adminAuditEventService.record("user.created", "user", saved.getId().toString());
        return userView(saved, null);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminUserDTO updateUser(
            Long id, String username, boolean enabled, Set<String> roles, String currentUsername) {
        validateUser(username, null);
        UserEntity existing = findUser(id);
        return updateUserInternal(
                id,
                username,
                null,
                null,
                existing.getEmail(),
                existing.isEmailVerified(),
                enabled,
                roles,
                currentUsername);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminUserDTO updateUser(
            Long id,
            String username,
            String email,
            boolean emailVerified,
            boolean enabled,
            Set<String> roles,
            String currentUsername) {
        UserEntity existing = findUser(id);
        return updateUserInternal(
                id,
                username,
                existing.getFirstName(),
                existing.getLastName(),
                email,
                emailVerified,
                enabled,
                roles,
                currentUsername);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminUserDTO updateUser(
            Long id,
            String username,
            String firstName,
            String lastName,
            String email,
            boolean emailVerified,
            boolean enabled,
            Set<String> roles,
            String currentUsername) {
        return updateUserInternal(
                id,
                username,
                firstName,
                lastName,
                email,
                emailVerified,
                enabled,
                roles,
                currentUsername);
    }

    private AdminUserDTO updateUserInternal(
            Long id,
            String username,
            String firstName,
            String lastName,
            String email,
            boolean emailVerified,
            boolean enabled,
            Set<String> roles,
            String currentUsername) {
        validateUser(username, null);
        UserEntity user = findUser(id);
        firstName = normalizeName(firstName == null ? user.getFirstName() : firstName);
        lastName = normalizeName(lastName == null ? user.getLastName() : lastName);
        String normalizedEmail = normalizeEmail(email);
        assertEmailAvailable(normalizedEmail, id);
        assertCanManageUser(user, currentUsername);
        if (!user.getUsername().equals(username)
                && userRepository.findByUsername(username).isPresent()) {
            throw ApiException.conflict(
                    USERNAME_FIELD,
                    ApiErrorCode.USER_DUPLICATE_USERNAME,
                    "Username is already registered");
        }
        if (user.getUsername().equals(currentUsername) && !enabled) {
            throw ApiException.badRequest(
                    ApiErrorCode.USER_PROTECTED, "You cannot disable your own account");
        }
        assertRoleAssignmentAllowed(roles, currentUsername);
        assertNotLastAdmin(user, requestedRoleNames(roles));
        ldapFederationWriteService.updateProfile(
                user, username, normalizedEmail, firstName, lastName);
        userAccessInvalidationService.invalidate(user.getUsername());
        userActionService.invalidateActions(user.getId());
        adminUserMapper.update(
                username,
                firstName,
                lastName,
                normalizedEmail,
                emailVerified,
                enabled,
                user.getPassword(),
                resolveAuthorities(roles),
                user);
        adminAuditEventService.record("user.updated", "user", user.getId().toString());
        return userView(user, avatarUrl(user.getId()));
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void changePassword(Long id, String password, String currentUsername) {
        changePasswordInternal(id, password, true, currentUsername);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void changePassword(
            Long id, String password, boolean temporary, String currentUsername) {
        changePasswordInternal(id, password, temporary, currentUsername);
    }

    private void changePasswordInternal(
            Long id, String password, boolean temporary, String currentUsername) {
        if (password == null || password.length() < 12) {
            throw ApiException.badRequest(
                    "password",
                    ApiErrorCode.USER_INVALID_PASSWORD,
                    "Password must be at least 12 characters");
        }
        UserEntity user = findUser(id);
        assertCanManageUser(user, currentUsername);
        if (temporary) {
            passwordService.setTemporaryPassword(user, password);
        } else {
            passwordService.changePassword(user, password);
        }
        userAccessInvalidationService.invalidate(user.getUsername());
        userActionService.invalidateActions(user.getId());
        adminAuditEventService.record("user.password.updated", "user", user.getId().toString());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void resetTotp(Long id, String currentUsername) {
        UserEntity user = findUser(id);
        assertCanManageUser(user, currentUsername);
        user.setTotpSecret(null);
        user.setTotpEnabled(false);
        user.setTotpLastUsedCounter(null);
        user.setMfaFailedAttemptCount(0);
        user.setMfaPermanentlyLocked(false);
        if (recoveryCodeRepository != null) {
            recoveryCodeRepository.deleteByUserId(id);
        }
        userActionService.invalidateActions(id);
        userAccessInvalidationService.invalidate(user.getUsername());
        adminAuditEventService.record("user.totp.reset", "user", user.getId().toString());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void unlockUser(Long id, String currentUsername) {
        UserEntity user = findUser(id);
        assertCanManageUser(user, currentUsername);
        accountLockService.unlock(id);
        adminAuditEventService.record("user.account.unlocked", "user", id.toString());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void deleteUser(Long id, String currentUsername) {
        UserEntity user = findUser(id);
        assertCanManageUser(user, currentUsername);
        if (user.getUsername().equals(currentUsername)) {
            throw ApiException.badRequest(
                    ApiErrorCode.USER_PROTECTED, "You cannot delete your own account");
        }
        assertNotLastAdmin(user, Set.of());
        userAccessInvalidationService.invalidate(user.getUsername());
        userRepository.delete(user);
        adminAuditEventService.record("user.deleted", "user", id.toString());
    }

    @Transactional(readOnly = true)
    public Page<AdminUserDTO> users(String query, Boolean enabled, Pageable pageable) {
        String searchQuery = AdminSearch.normalize(query);
        Page<UserEntity> users = userRepository.searchUsers(searchQuery, enabled, pageable);
        if (users == null) {
            users =
                    enabled == null
                            ? userRepository.findByUsernameContainingIgnoreCase(
                                    searchQuery, pageable)
                            : userRepository.findByUsernameContainingIgnoreCaseAndEnabled(
                                    searchQuery, enabled, pageable);
        }
        return new PageImpl<>(userViews(users.getContent()), pageable, users.getTotalElements());
    }

    @Transactional(readOnly = true)
    public Page<AdminGroupDTO> groups(
            Long userId, String query, Pageable pageable, String currentUsername) {
        UserEntity user = findUser(userId);
        assertCanManageUser(user, currentUsername);
        Page<GroupEntity> groups =
                groupRepository.findByUserIdAndNameContainingIgnoreCase(
                        userId, AdminSearch.normalize(query), pageable);
        return groupViews(groups, pageable);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminUserDTO assignRole(Long id, String roleName, String currentUsername) {
        UserEntity user = findUser(id);
        assertCanManageUser(user, currentUsername);
        AuthorityEntity role =
                authorityRepository
                        .findByName(roleName)
                        .orElseThrow(() -> ApiException.notFound("Role not found"));
        if (user.getAuthorities().add(role)) {
            userAccessInvalidationService.invalidate(user.getUsername());
            adminAuditEventService.record("user.role.assigned", "user", id.toString());
        }
        return userView(user, avatarUrl(user.getId()));
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminUserDTO removeRole(Long id, String roleName, String currentUsername) {
        UserEntity user = findUser(id);
        assertCanManageUser(user, currentUsername);
        Set<String> remaining =
                user.getAuthorities().stream()
                        .map(AuthorityEntity::getName)
                        .filter(name -> !name.equals(roleName))
                        .collect(java.util.stream.Collectors.toSet());
        assertNotLastAdmin(user, remaining);
        if (user.getAuthorities().removeIf(authority -> authority.getName().equals(roleName))) {
            if (user.getAuthorities().isEmpty()) {
                adminUserMapper.updateAuthorities(
                        resolveAuthorities(Set.of(AuthoritiesConstants.USER)), user);
            }
            userAccessInvalidationService.invalidate(user.getUsername());
            adminAuditEventService.record("user.role.removed", "user", id.toString());
        }
        return userView(user, avatarUrl(user.getId()));
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void setUserEnabled(Long id, boolean enabled, String currentUsername) {
        UserEntity user = findUser(id);
        assertCanManageUser(user, currentUsername);
        if (user.getUsername().equals(currentUsername) && !enabled) {
            throw ApiException.badRequest(
                    ApiErrorCode.USER_PROTECTED, "You cannot disable your own account");
        }
        if (!enabled) {
            assertNotLastAdmin(user, Set.of());
            userAccessInvalidationService.invalidate(user.getUsername());
        }
        adminUserMapper.updateEnabled(enabled, user);
        adminAuditEventService.record(USER_ENABLED_UPDATED_EVENT, "user", user.getId().toString());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminUserBulkOperationDTO bulkOperate(
            List<Long> userIds, AdminUserBulkAction action, String currentUsername) {
        List<Long> distinctIds = userIds.stream().distinct().toList();
        List<UserEntity> users = userRepository.findAllByIdIn(distinctIds);
        Map<Long, UserEntity> usersById =
                users.stream().collect(Collectors.toMap(UserEntity::getId, Function.identity()));
        if (usersById.size() != distinctIds.size()) {
            throw ApiException.notFound("One or more users were not found");
        }

        users = distinctIds.stream().map(usersById::get).toList();
        users.forEach(user -> assertCanManageUser(user, currentUsername));
        if (action == AdminUserBulkAction.DISABLE || action == AdminUserBulkAction.DELETE) {
            users.forEach(
                    user -> {
                        if (user.getUsername().equals(currentUsername)) {
                            throw ApiException.badRequest(
                                    ApiErrorCode.USER_PROTECTED,
                                    "You cannot disable or delete your own account");
                        }
                    });
            long selectedAdministrators = users.stream().filter(this::isAdministrator).count();
            if (selectedAdministrators > 0 && effectiveAdminCount() - selectedAdministrators <= 0) {
                throw ApiException.badRequest(
                        ApiErrorCode.LAST_ADMIN_PROTECTED,
                        "The last administrator must be retained");
            }
        }

        for (UserEntity user : users) {
            switch (action) {
                case ENABLE -> {
                    adminUserMapper.updateEnabled(true, user);
                    adminAuditEventService.record(
                            USER_ENABLED_UPDATED_EVENT, "user", user.getId().toString());
                }
                case DISABLE -> {
                    userAccessInvalidationService.invalidate(user.getUsername());
                    adminUserMapper.updateEnabled(false, user);
                    adminAuditEventService.record(
                            USER_ENABLED_UPDATED_EVENT, "user", user.getId().toString());
                }
                case DELETE -> {
                    userAccessInvalidationService.invalidate(user.getUsername());
                    userRepository.delete(user);
                    adminAuditEventService.record("user.deleted", "user", user.getId().toString());
                }
                default -> throw new IllegalStateException("Unsupported bulk action: " + action);
            }
        }
        return new AdminUserBulkOperationDTO(action, users.size());
    }

    @Transactional
    public void executeActionsEmail(
            Long id,
            UserAction action,
            Long lifespanSeconds,
            Locale locale,
            String currentUsername) {
        requireManageableUserInternal(id, currentUsername);
        userActionService.executeActionsEmail(id, action, lifespanSeconds, locale);
    }

    @Transactional(readOnly = true)
    public UserEntity requireManageableUser(Long id, String currentUsername) {
        return requireManageableUserInternal(id, currentUsername);
    }

    private UserEntity requireManageableUserInternal(Long id, String currentUsername) {
        UserEntity user = findUser(id);
        assertCanManageUser(user, currentUsername);
        return user;
    }

    @Transactional(readOnly = true)
    public void assertCanManageUsername(String username, String currentUsername) {
        userRepository
                .findByUsername(username)
                .ifPresentOrElse(
                        user -> assertCanManageUser(user, currentUsername),
                        () -> {
                            throw ApiException.notFound("User not found");
                        });
    }

    private UserEntity findUser(Long id) {
        return userRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private Set<AuthorityEntity> resolveAuthorities(Set<String> roles) {
        Set<String> requestedRoles = requestedRoleNames(roles);
        List<AuthorityEntity> authorities = authorityRepository.findByNameIn(requestedRoles);
        if (authorities.size() != requestedRoles.size()) {
            throw ApiException.badRequest(
                    "roles", ApiErrorCode.USER_INVALID_ROLES, "One or more roles are invalid");
        }
        return Set.copyOf(authorities);
    }

    private void assertRoleAssignmentAllowed(Set<String> roles, String currentUsername) {
        Set<String> administratorRoles =
                authorities(userRepository.findByUsername(currentUsername).orElseThrow());
        Set<String> requestedRoles = requestedRoleNames(roles);
        if (!administratorRoles.contains(AuthoritiesConstants.ADMIN)
                && !administratorRoles.containsAll(requestedRoles)) {
            throw ApiException.forbidden(
                    ApiErrorCode.ROLE_ESCALATION, "You can only assign roles you already have");
        }
    }

    private void assertCanManageUser(UserEntity target, String currentUsername) {
        Set<String> administratorRoles =
                authorities(userRepository.findByUsername(currentUsername).orElseThrow());
        if (!administratorRoles.contains(AuthoritiesConstants.ADMIN)
                && authorities(target).contains(AuthoritiesConstants.ADMIN)) {
            throw ApiException.forbidden(
                    ApiErrorCode.USER_PROTECTED,
                    "Only an administrator can manage an administrator");
        }
    }

    private void assertNotLastAdmin(UserEntity user, Set<String> replacementRoles) {
        if (authorities(user).contains(AuthoritiesConstants.ADMIN)
                && !replacementRoles.contains(AuthoritiesConstants.ADMIN)
                && effectiveAdminCount() <= 1) {
            throw ApiException.badRequest(
                    ApiErrorCode.LAST_ADMIN_PROTECTED, "The last administrator must be retained");
        }
    }

    private long effectiveAdminCount() {
        List<UserEntity> users = userRepository.findAllWithEffectiveAuthorities();
        if (users != null && !users.isEmpty()) {
            return users.stream()
                    .filter(user -> authorities(user).contains(AuthoritiesConstants.ADMIN))
                    .count();
        }
        return userRepository.countByAuthoritiesName(AuthoritiesConstants.ADMIN);
    }

    private List<AdminUserDTO> userViews(List<UserEntity> users) {
        if (users.isEmpty()) {
            return List.of();
        }
        Map<Long, UserAvatarRepository.AvatarVersion> avatars =
                userAvatarRepository
                        .findVersionsByUserIdIn(users.stream().map(UserEntity::getId).toList())
                        .stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        UserAvatarRepository.AvatarVersion::getUserId,
                                        java.util.function.Function.identity()));
        return users.stream()
                .map(user -> userView(user, avatarUrl(avatars.get(user.getId()))))
                .toList();
    }

    private String avatarUrl(Long userId) {
        return userAvatarRepository.findVersionByUserId(userId).map(this::avatarUrl).orElse(null);
    }

    private String avatarUrl(UserAvatarRepository.AvatarVersion avatar) {
        return avatar == null
                ? null
                : "/avatars/" + avatar.getPublicId() + "?v=" + avatar.getUpdatedAt().toEpochMilli();
    }

    private AdminUserDTO userView(UserEntity user, String avatarUrl) {
        return adminUserMapper.toDTO(
                user, avatarUrl == null || avatarUrl.isBlank() ? user.getPictureUrl() : avatarUrl);
    }

    private AdminGroupDTO groupView(GroupEntity group, long userCount) {
        return adminGroupMapper.toDTO(group, userCount);
    }

    private Page<AdminGroupDTO> groupViews(Page<GroupEntity> groups, Pageable pageable) {
        List<GroupEntity> content = groups.getContent();
        if (content.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, groups.getTotalElements());
        }
        Map<Long, Long> userCounts =
                userRepository
                        .countUsersByGroupIdIn(content.stream().map(GroupEntity::getId).toList())
                        .stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        UserRepository.GroupUserCount::getGroupId,
                                        UserRepository.GroupUserCount::getUserCount));
        return groups.map(group -> groupView(group, userCounts.getOrDefault(group.getId(), 0L)));
    }

    private static Set<String> authorities(UserEntity user) {
        return EffectiveRoleService.effectiveRoleNames(user);
    }

    private boolean isAdministrator(UserEntity user) {
        return authorities(user).contains(AuthoritiesConstants.ADMIN);
    }

    private static Set<String> requestedRoleNames(Set<String> roles) {
        return roles == null || roles.isEmpty() ? Set.of(AuthoritiesConstants.USER) : roles;
    }

    private static void validateUser(String username, String password) {
        if (username == null || username.isBlank()) {
            throw ApiException.badRequest(
                    USERNAME_FIELD, ApiErrorCode.USER_INVALID_USERNAME, "Username is required");
        }
        if (password != null && password.length() < 12) {
            throw ApiException.badRequest(
                    "password",
                    ApiErrorCode.USER_INVALID_PASSWORD,
                    "Password must be at least 12 characters");
        }
    }

    private void assertEmailAvailable(String email, Long userId) {
        if (email == null) {
            return;
        }
        boolean exists =
                userId == null
                        ? userRepository.findByEmailIgnoreCase(email).isPresent()
                        : userRepository.existsByEmailIgnoreCaseAndIdNot(email, userId);
        if (exists) {
            throw ApiException.conflict(
                    "email", ApiErrorCode.USER_DUPLICATE_EMAIL, "Email is already registered");
        }
    }

    private static String normalizeEmail(String email) {
        return email == null || email.isBlank() ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeName(String name) {
        if (name == null) {
            return null;
        }
        String normalized = name.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
