package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminGroupDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminUserBulkAction;
import io.github.susimsek.springauthserversamples.dto.admin.AdminUserDTO;
import io.github.susimsek.springauthserversamples.mapper.AdminGroupMapper;
import io.github.susimsek.springauthserversamples.mapper.AdminUserMapper;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.GroupRepository;
import io.github.susimsek.springauthserversamples.repository.RecoveryCodeRepository;
import io.github.susimsek.springauthserversamples.repository.UserAvatarRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthoritiesConstants;
import io.github.susimsek.springauthserversamples.service.LdapFederationWriteService;
import io.github.susimsek.springauthserversamples.service.account.UserActionService;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import io.github.susimsek.springauthserversamples.service.security.AccountLockService;
import io.github.susimsek.springauthserversamples.service.security.PasswordService;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class AdminUserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private GroupRepository groupRepository;
    @Mock private UserAvatarRepository userAvatarRepository;
    @Mock private AuthorityRepository authorityRepository;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;
    @Mock private AccountLockService accountLockService;
    @Mock private PasswordService passwordService;
    @Mock private AdminAuditEventService adminAuditEventService;
    @Mock private UserActionService userActionService;
    @Mock private LdapFederationWriteService ldapFederationWriteService;

    @Test
    void userReturnsMappedViewWithAvatar() {
        UserEntity target = user(7L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(8L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(7L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(userAvatarRepository.findVersionByUserId(7L))
                .thenReturn(Optional.of(avatar(7L, "avatar-7", 42L)));

        AdminUserDTO view = service().user(7L, "administrator");

        assertThat(view.id()).isEqualTo(7L);
        assertThat(view.username()).isEqualTo("alice");
        assertThat(view.avatarUrl()).isEqualTo("/avatars/avatar-7?v=42");
        assertThat(view.authorities()).containsExactly(AuthoritiesConstants.USER);
    }

    @Test
    void userRejectsManagingAdministratorForNonAdminManager() {
        UserEntity target = user(5L, "administrator", AuthoritiesConstants.ADMIN);
        UserEntity manager = user(6L, "manager", "ROLE_USER_MANAGER");
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("manager")).thenReturn(Optional.of(manager));

        assertThatThrownBy(() -> service().user(5L, "manager"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Only an administrator can manage an administrator");
    }

    @Test
    void createUserRejectsBlankUsername() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .createUser(
                                                " ",
                                                "password-123",
                                                true,
                                                Set.of(),
                                                "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Username is required");
    }

    @Test
    void createUserRejectsShortPassword() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .createUser(
                                                "alice", "short", true, Set.of(), "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Password must be at least 12 characters");
    }

    @Test
    void createsUserWithEncodedPasswordAndDefaultRole() {
        UserEntity administrator = user(1L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.empty());
        when(authorityRepository.findByNameIn(Set.of(AuthoritiesConstants.USER)))
                .thenReturn(List.of(authority(1L, AuthoritiesConstants.USER)));
        org.mockito.Mockito.doAnswer(
                        invocation -> {
                            invocation.<UserEntity>getArgument(0).setPassword("encoded-password");
                            return null;
                        })
                .when(passwordService)
                .setInitialPassword(any(UserEntity.class), org.mockito.Mockito.eq("password-123"));
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity saved = invocation.getArgument(0);
                            saved.setId(99L);
                            return saved;
                        });

        AdminUserDTO created =
                service().createUser("alice", "password-123", true, Set.of(), "administrator");

        assertThat(created.username()).isEqualTo("alice");
        assertThat(created.enabled()).isTrue();
        assertThat(created.avatarUrl()).isNull();
        assertThat(created.authorities()).containsExactly(AuthoritiesConstants.USER);
        verify(adminAuditEventService).record("user.created", "user", created.id().toString());
    }

    @Test
    void createsTemporaryUserWithNormalizedProfileAndDefaultGroups() {
        UserEntity administrator = user(1L, "administrator", AuthoritiesConstants.ADMIN);
        GroupEntity defaultGroup = new GroupEntity();
        defaultGroup.setId(20L);
        defaultGroup.setName("default");
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("alice@example.com"))
                .thenReturn(Optional.empty());
        when(authorityRepository.findByNameIn(Set.of(AuthoritiesConstants.USER)))
                .thenReturn(List.of(authority(1L, AuthoritiesConstants.USER)));
        when(groupRepository.findByDefaultGroupTrueOrderByNameAsc())
                .thenReturn(List.of(defaultGroup));
        org.mockito.Mockito.doAnswer(
                        invocation -> {
                            invocation.<UserEntity>getArgument(0).setPassword("temporary-password");
                            return null;
                        })
                .when(passwordService)
                .setTemporaryPassword(
                        any(UserEntity.class), org.mockito.Mockito.eq("password-123"));
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity saved = invocation.getArgument(0);
                            saved.setId(99L);
                            return saved;
                        });

        AdminUserDTO created =
                service()
                        .createUser(
                                "alice",
                                " Alice ",
                                " Smith ",
                                " ALICE@EXAMPLE.COM ",
                                false,
                                "password-123",
                                true,
                                true,
                                Set.of(AuthoritiesConstants.USER),
                                "administrator");

        assertThat(created.username()).isEqualTo("alice");
        assertThat(created.firstName()).isEqualTo("Alice");
        assertThat(created.lastName()).isEqualTo("Smith");
        assertThat(created.email()).isEqualTo("alice@example.com");
        verify(passwordService)
                .setTemporaryPassword(
                        any(UserEntity.class), org.mockito.Mockito.eq("password-123"));
        verify(userRepository).save(any(UserEntity.class));
    }

    @Test
    void createsUserWithoutDefaultGroupsWhenRepositoryReturnsNull() {
        UserEntity administrator = user(1L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.empty());
        when(authorityRepository.findByNameIn(Set.of(AuthoritiesConstants.USER)))
                .thenReturn(List.of(authority(1L, AuthoritiesConstants.USER)));
        when(groupRepository.findByDefaultGroupTrueOrderByNameAsc()).thenReturn(null);
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity saved = invocation.getArgument(0);
                            saved.setId(99L);
                            return saved;
                        });

        AdminUserDTO created =
                service().createUser("alice", "password-123", true, Set.of(), "administrator");

        assertThat(created.username()).isEqualTo("alice");
    }

    @Test
    void entersTheShortProfileCreateOverload() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .createUser(
                                                " ",
                                                "First",
                                                "Last",
                                                "alice@example.com",
                                                true,
                                                "password-123",
                                                true,
                                                Set.of(),
                                                "administrator"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void createUserRejectsDuplicateUsername() {
        UserEntity administrator = user(2L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("alice"))
                .thenReturn(Optional.of(user(1L, "alice", AuthoritiesConstants.USER)));

        assertThatThrownBy(
                        () ->
                                service()
                                        .createUser(
                                                "alice",
                                                "password-123",
                                                true,
                                                Set.of(),
                                                "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Username is already registered");
    }

    @Test
    void createUserRejectsUnknownRole() {
        UserEntity administrator = user(1L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.empty());
        when(authorityRepository.findByNameIn(Set.of("ROLE_UNKNOWN"))).thenReturn(List.of());

        assertThatThrownBy(
                        () ->
                                service()
                                        .createUser(
                                                "alice",
                                                "password-123",
                                                true,
                                                Set.of("ROLE_UNKNOWN"),
                                                "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("One or more roles are invalid");
    }

    @Test
    void userManagerCannotCreateUserWithAnUnassignedRole() {
        UserEntity manager = user(6L, "manager", "ROLE_USER_MANAGER");
        when(userRepository.findByUsername("manager")).thenReturn(Optional.of(manager));

        assertThatThrownBy(
                        () ->
                                service()
                                        .createUser(
                                                "alice",
                                                "password-123",
                                                true,
                                                Set.of(AuthoritiesConstants.ADMIN),
                                                "manager"))
                .isInstanceOf(ApiException.class)
                .hasMessage("You can only assign roles you already have");
    }

    @Test
    void updateUserRejectsBlankUsername() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .updateUser(
                                                5L,
                                                " ",
                                                true,
                                                Set.of(AuthoritiesConstants.USER),
                                                "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Username is required");
    }

    @Test
    void updateUserRejectsDuplicateUsernameWhenChangingName() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("bob"))
                .thenReturn(Optional.of(user(9L, "bob", AuthoritiesConstants.USER)));

        assertThatThrownBy(
                        () ->
                                service()
                                        .updateUser(
                                                5L,
                                                "bob",
                                                true,
                                                Set.of(AuthoritiesConstants.USER),
                                                "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Username is already registered");
    }

    @Test
    void updateUserRejectsDisablingOwnAccount() {
        UserEntity administrator = user(5L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        assertThatThrownBy(
                        () ->
                                service()
                                        .updateUser(
                                                5L,
                                                "administrator",
                                                false,
                                                Set.of(AuthoritiesConstants.ADMIN),
                                                "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("You cannot disable your own account");
    }

    @Test
    void updateRejectsRoleEscalationForNonAdminManager() {
        UserEntity target = user(5L, "operator", AuthoritiesConstants.USER);
        UserEntity manager = user(6L, "manager", "ROLE_USER_MANAGER");
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("manager")).thenReturn(Optional.of(manager));

        assertThatThrownBy(
                        () ->
                                service()
                                        .updateUser(
                                                5L,
                                                "operator",
                                                true,
                                                Set.of(AuthoritiesConstants.ADMIN),
                                                "manager"))
                .isInstanceOf(ApiException.class)
                .hasMessage("You can only assign roles you already have");
    }

    @Test
    void lastAdministratorCannotRemoveItsAdministratorRole() {
        UserEntity administrator = user(5L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(userRepository.countByAuthoritiesName(AuthoritiesConstants.ADMIN)).thenReturn(1L);

        assertThatThrownBy(
                        () ->
                                service()
                                        .updateUser(
                                                5L,
                                                "administrator",
                                                true,
                                                Set.of(AuthoritiesConstants.USER),
                                                "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("The last administrator must be retained");
    }

    @Test
    void updateUserReplacesFieldsInvalidatesSessionsAndAudits() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        AuthorityEntity adminRole = authority(2L, AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(authorityRepository.findByNameIn(Set.of(AuthoritiesConstants.ADMIN)))
                .thenReturn(List.of(adminRole));
        when(userAvatarRepository.findVersionByUserId(5L)).thenReturn(Optional.empty());

        AdminUserDTO updated =
                service()
                        .updateUser(
                                5L,
                                "alice-updated",
                                false,
                                Set.of(AuthoritiesConstants.ADMIN),
                                "administrator");

        assertThat(updated.username()).isEqualTo("alice-updated");
        assertThat(updated.enabled()).isFalse();
        assertThat(updated.authorities()).containsExactly(AuthoritiesConstants.ADMIN);
        verify(userAccessInvalidationService).invalidate("alice");
        verify(adminAuditEventService).record("user.updated", "user", "5");
    }

    @Test
    void updateUserRejectsDuplicateEmail() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.existsByEmailIgnoreCaseAndIdNot("taken@example.com", 5L))
                .thenReturn(true);

        assertThatThrownBy(
                        () ->
                                service()
                                        .updateUser(
                                                5L,
                                                "alice",
                                                "taken@example.com",
                                                false,
                                                true,
                                                Set.of(AuthoritiesConstants.USER),
                                                "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Email is already registered");
    }

    @Test
    void userManagerCannotResetAnAdministratorsPassword() {
        UserEntity administrator = user(5L, "administrator", AuthoritiesConstants.ADMIN);
        UserEntity manager = user(6L, "manager", "ROLE_USER_MANAGER");
        when(userRepository.findById(5L)).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("manager")).thenReturn(Optional.of(manager));

        assertThatThrownBy(() -> service().changePassword(5L, "new-password", "manager"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Only an administrator can manage an administrator");
    }

    @Test
    void changePasswordRejectsShortPasswords() {
        assertThatThrownBy(() -> service().changePassword(5L, "short", "manager"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Password must be at least 12 characters");
    }

    @Test
    void changePasswordEncodesPasswordInvalidatesSessionsAndAudits() {
        UserEntity user = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        org.mockito.Mockito.doAnswer(
                        invocation -> {
                            invocation.<UserEntity>getArgument(0).setPassword("encoded-password");
                            return null;
                        })
                .when(passwordService)
                .setTemporaryPassword(
                        any(UserEntity.class), org.mockito.Mockito.eq("new-password"));

        service().changePassword(5L, "new-password", "administrator");

        assertThat(user.getPassword()).isEqualTo("encoded-password");
        verify(userAccessInvalidationService).invalidate("alice");
        verify(adminAuditEventService).record("user.password.updated", "user", "5");
    }

    @Test
    void userManagerCannotDisableAnAdministrator() {
        UserEntity administrator = user(5L, "administrator", AuthoritiesConstants.ADMIN);
        UserEntity manager = user(6L, "manager", "ROLE_USER_MANAGER");
        when(userRepository.findById(5L)).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("manager")).thenReturn(Optional.of(manager));

        assertThatThrownBy(() -> service().setUserEnabled(5L, false, "manager"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Only an administrator can manage an administrator");
    }

    @Test
    void disablingOwnAccountIsRejected() {
        UserEntity administrator = user(5L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        assertThatThrownBy(() -> service().setUserEnabled(5L, false, "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("You cannot disable your own account");
    }

    @Test
    void disablingLastAdministratorIsRejected() {
        UserEntity administrator = user(5L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("admin"))
                .thenReturn(Optional.of(user(7L, "admin", AuthoritiesConstants.ADMIN)));
        when(userRepository.countByAuthoritiesName(AuthoritiesConstants.ADMIN)).thenReturn(1L);

        assertThatThrownBy(() -> service().setUserEnabled(5L, false, "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("The last administrator must be retained");
    }

    @Test
    void disablingUserInvalidatesSessionsAndAudits() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        service().setUserEnabled(5L, false, "administrator");

        assertThat(target.isEnabled()).isFalse();
        verify(userAccessInvalidationService).invalidate("alice");
        verify(adminAuditEventService).record("user.enabled.updated", "user", "5");
    }

    @Test
    void resetTotpRemovesAuthenticatorAndInvalidatesAccess() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        target.setTotpSecret("JBSWY3DPEHPK3PXP");
        target.setTotpEnabled(true);
        target.setTotpLastUsedCounter(123L);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        service().resetTotp(5L, "administrator");

        assertThat(target.getTotpSecret()).isNull();
        assertThat(target.isTotpEnabled()).isFalse();
        assertThat(target.getTotpLastUsedCounter()).isNull();
        verify(userActionService).invalidateActions(5L);
        verify(userAccessInvalidationService).invalidate("alice");
        verify(adminAuditEventService).record("user.totp.reset", "user", "5");
    }

    @Test
    void resetTotpDeletesRecoveryCodesWhenRepositoryIsAvailable() {
        RecoveryCodeRepository recoveryCodeRepository = mock(RecoveryCodeRepository.class);
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        service(recoveryCodeRepository).resetTotp(5L, "administrator");

        verify(recoveryCodeRepository).deleteByUserId(5L);
    }

    @Test
    void unlockUserDelegatesToAccountLockServiceAndAudits() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        service().unlockUser(5L, "administrator");

        verify(accountLockService).unlock(5L);
        verify(adminAuditEventService).record("user.account.unlocked", "user", "5");
    }

    @Test
    void enablingUserDoesNotInvalidateSessions() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        target.setEnabled(false);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        service().setUserEnabled(5L, true, "administrator");

        assertThat(target.isEnabled()).isTrue();
        verify(userAccessInvalidationService, never()).invalidate("alice");
        verify(adminAuditEventService).record("user.enabled.updated", "user", "5");
    }

    @Test
    void bulkDisableInvalidatesEverySelectedUserAndAuditsEachMutation() {
        UserEntity first = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity second = user(6L, "bob", AuthoritiesConstants.USER);
        UserEntity administrator = user(7L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findAllByIdIn(List.of(5L, 6L))).thenReturn(List.of(first, second));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        var result =
                service()
                        .bulkOperate(List.of(5L, 6L), AdminUserBulkAction.DISABLE, "administrator");

        assertThat(result.action()).isEqualTo(AdminUserBulkAction.DISABLE);
        assertThat(result.userCount()).isEqualTo(2);
        assertThat(first.isEnabled()).isFalse();
        assertThat(second.isEnabled()).isFalse();
        verify(userAccessInvalidationService).invalidate("alice");
        verify(userAccessInvalidationService).invalidate("bob");
        verify(adminAuditEventService).record("user.enabled.updated", "user", "5");
        verify(adminAuditEventService).record("user.enabled.updated", "user", "6");
    }

    @Test
    void bulkDeleteRejectsRemovingTheLastAdministrator() {
        UserEntity target = user(5L, "administrator-target", AuthoritiesConstants.ADMIN);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findAllByIdIn(List.of(5L))).thenReturn(List.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(userRepository.findAllWithEffectiveAuthorities()).thenReturn(List.of(target));

        assertThatThrownBy(
                        () ->
                                service()
                                        .bulkOperate(
                                                List.of(5L),
                                                AdminUserBulkAction.DELETE,
                                                "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("The last administrator must be retained");
        verify(userRepository, never()).delete(any(UserEntity.class));
        verify(userAccessInvalidationService, never()).invalidate("administrator-target");
    }

    @Test
    void deleteRejectsCurrentUserDeletion() {
        UserEntity administrator = user(5L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        assertThatThrownBy(() -> service().deleteUser(5L, "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("You cannot delete your own account");
    }

    @Test
    void deleteRejectsRemovingLastAdministrator() {
        UserEntity administrator = user(5L, "administrator", AuthoritiesConstants.ADMIN);
        UserEntity otherAdministrator = user(6L, "other-admin", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(administrator));
        when(userRepository.findByUsername("other-admin"))
                .thenReturn(Optional.of(otherAdministrator));
        when(userRepository.countByAuthoritiesName(AuthoritiesConstants.ADMIN)).thenReturn(1L);

        assertThatThrownBy(() -> service().deleteUser(5L, "other-admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("The last administrator must be retained");
    }

    @Test
    void deleteUserInvalidatesSessionsDeletesEntityAndAudits() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        service().deleteUser(5L, "administrator");

        verify(userAccessInvalidationService).invalidate("alice");
        verify(userRepository).delete(target);
        verify(adminAuditEventService).record("user.deleted", "user", "5");
    }

    @Test
    void usersFiltersByEnabledFlagAndMapsAvatar() {
        UserEntity user = user(7L, "alice", AuthoritiesConstants.USER);
        when(userRepository.findByUsernameContainingIgnoreCaseAndEnabled(
                        "alice", true, Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(user)));
        when(userAvatarRepository.findVersionsByUserIdIn(List.of(7L)))
                .thenReturn(List.of(avatar(7L, "avatar-1", 42L)));

        AdminUserDTO view =
                service().users("alice", true, Pageable.unpaged()).getContent().getFirst();

        assertThat(view.avatarUrl()).isEqualTo("/avatars/avatar-1?v=42");
        assertThat(view.authorities()).containsExactly(AuthoritiesConstants.USER);
    }

    @Test
    void usersUsesUnfilteredQueryWhenEnabledFlagIsNull() {
        UserEntity user = user(7L, "alice", AuthoritiesConstants.USER);
        when(userRepository.findByUsernameContainingIgnoreCase("alice", Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(user)));
        when(userAvatarRepository.findVersionsByUserIdIn(List.of(7L))).thenReturn(List.of());

        AdminUserDTO view =
                service().users(" alice ", null, Pageable.unpaged()).getContent().getFirst();

        assertThat(view.avatarUrl()).isNull();
        assertThat(view.username()).isEqualTo("alice");
    }

    @Test
    void usersReturnsEmptyPageWithoutLoadingAvatars() {
        when(userRepository.findByUsernameContainingIgnoreCase("", Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of()));

        assertThat(service().users(null, null, Pageable.unpaged()).getContent()).isEmpty();
        verify(userAvatarRepository, never()).findVersionsByUserIdIn(any());
    }

    @Test
    void assertCanManageUsernameThrowsNotFoundForMissingUser() {
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().assertCanManageUsername("missing", "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");
    }

    @Test
    void assertCanManageUsernameAllowsManageableUser() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        service().assertCanManageUsername("alice", "administrator");
    }

    @Test
    void requireManageableUserReturnsUserForAdministrator() {
        UserEntity target = user(5L, "operator", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        assertThat(service().requireManageableUser(5L, "administrator")).isSameAs(target);
    }

    @Test
    void groupsReturnsOnlyGroupsOfManageableUser() {
        GroupEntity group = new GroupEntity();
        group.setId(7L);
        group.setName("finance");
        group.setAuthorities(Set.of(authority(3L, AuthoritiesConstants.USER)));
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(groupRepository.findByUserIdAndNameContainingIgnoreCase(
                        org.mockito.ArgumentMatchers.eq(5L),
                        org.mockito.ArgumentMatchers.eq(""),
                        any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(group)));
        when(userRepository.countUsersByGroupIdIn(List.of(7L)))
                .thenReturn(List.of(groupUserCount(7L, 1L)));

        var result = service().groups(5L, "", Pageable.ofSize(20), "administrator");

        assertThat(result.getContent())
                .containsExactly(
                        new AdminGroupDTO(
                                7L,
                                "finance",
                                "finance",
                                null,
                                Set.of(AuthoritiesConstants.USER),
                                1));
    }

    @Test
    void groupsReturnsEmptyPageWithoutLoadingCounts() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(groupRepository.findByUserIdAndNameContainingIgnoreCase(5L, "", Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of()));

        assertThat(service().groups(5L, null, Pageable.ofSize(20), "administrator").getContent())
                .isEmpty();
        verify(userRepository, never()).countUsersByGroupIdIn(any());
    }

    @Test
    void assignsAndRemovesRolesWithAccessInvalidation() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        AuthorityEntity managerRole = authority(3L, "ROLE_USER_MANAGER");
        target.getAuthorities().add(managerRole);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(authorityRepository.findByName("ROLE_AUDITOR"))
                .thenReturn(Optional.of(authority(4L, "ROLE_AUDITOR")));
        when(userAvatarRepository.findVersionByUserId(5L)).thenReturn(Optional.empty());

        service().assignRole(5L, "ROLE_AUDITOR", "administrator");
        service().removeRole(5L, "ROLE_USER_MANAGER", "administrator");

        verify(userAccessInvalidationService, times(2)).invalidate("alice");
        verify(adminAuditEventService).record("user.role.assigned", "user", "5");
        verify(adminAuditEventService).record("user.role.removed", "user", "5");
    }

    @Test
    void skipsAccessChangesForDuplicateOrMissingRoles() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        AuthorityEntity existingRole = authority(3L, AuthoritiesConstants.USER);
        target.setAuthorities(new java.util.HashSet<>(Set.of(existingRole)));
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(existingRole));
        when(userAvatarRepository.findVersionByUserId(5L)).thenReturn(Optional.empty());

        service().assignRole(5L, AuthoritiesConstants.USER, "administrator");
        service().removeRole(5L, "ROLE_MISSING", "administrator");

        verify(userAccessInvalidationService, never()).invalidate("alice");
        verify(adminAuditEventService, never()).record("user.role.assigned", "user", "5");
        verify(adminAuditEventService, never()).record("user.role.removed", "user", "5");
    }

    @Test
    void removingTheLastRoleRestoresTheDefaultUserRole() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(authorityRepository.findByNameIn(Set.of(AuthoritiesConstants.USER)))
                .thenReturn(List.of(authority(1L, AuthoritiesConstants.USER)));
        when(userAvatarRepository.findVersionByUserId(5L)).thenReturn(Optional.empty());

        service().removeRole(5L, AuthoritiesConstants.USER, "administrator");

        verify(userAccessInvalidationService).invalidate("alice");
        verify(adminAuditEventService).record("user.role.removed", "user", "5");
    }

    @Test
    void executesBulkEnableDisableAndDeleteOperations() {
        UserEntity first = user(1L, "alice", AuthoritiesConstants.USER);
        UserEntity second = user(2L, "bob", AuthoritiesConstants.USER);
        UserEntity administrator = user(3L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findAllByIdIn(List.of(1L, 2L))).thenReturn(List.of(first, second));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        assertThat(
                        service()
                                .bulkOperate(
                                        List.of(1L, 2L, 1L),
                                        AdminUserBulkAction.ENABLE,
                                        "administrator")
                                .userCount())
                .isEqualTo(2);
        service().bulkOperate(List.of(1L, 2L), AdminUserBulkAction.DISABLE, "administrator");
        service().bulkOperate(List.of(1L, 2L), AdminUserBulkAction.DELETE, "administrator");

        verify(userRepository, times(2)).delete(any(UserEntity.class));
        verify(userAccessInvalidationService, org.mockito.Mockito.atLeast(4))
                .invalidate(any(String.class));
    }

    @Test
    void usesSearchUsersResultAndExecutesActionEmail() {
        UserEntity target = user(5L, "alice", AuthoritiesConstants.USER);
        UserEntity administrator = user(6L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.searchUsers("", null, Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(target)));
        when(userAvatarRepository.findVersionsByUserIdIn(List.of(5L))).thenReturn(List.of());
        when(userRepository.findById(5L)).thenReturn(Optional.of(target));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));

        assertThat(service().users(null, null, Pageable.unpaged()).getContent())
                .singleElement()
                .extracting(AdminUserDTO::username)
                .isEqualTo("alice");
        service()
                .executeActionsEmail(
                        5L,
                        io.github.susimsek.springauthserversamples.domain.UserAction.VERIFY_EMAIL,
                        600L,
                        Locale.ENGLISH,
                        "administrator");
        verify(userActionService)
                .executeActionsEmail(
                        5L,
                        io.github.susimsek.springauthserversamples.domain.UserAction.VERIFY_EMAIL,
                        600L,
                        Locale.ENGLISH);
    }

    @Test
    void bulkOperationRejectsMissingAndCurrentUsers() {
        UserEntity administrator = user(3L, "administrator", AuthoritiesConstants.ADMIN);
        when(userRepository.findAllByIdIn(List.of(1L))).thenReturn(List.of());

        assertThatThrownBy(
                        () ->
                                service()
                                        .bulkOperate(
                                                List.of(1L),
                                                AdminUserBulkAction.ENABLE,
                                                "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("One or more users were not found");

        when(userRepository.findAllByIdIn(List.of(3L))).thenReturn(List.of(administrator));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        assertThatThrownBy(
                        () ->
                                service()
                                        .bulkOperate(
                                                List.of(3L),
                                                AdminUserBulkAction.DELETE,
                                                "administrator"))
                .isInstanceOf(ApiException.class)
                .hasMessage("You cannot disable or delete your own account");
    }

    private AdminUserService service() {
        return service(null);
    }

    private AdminUserService service(RecoveryCodeRepository recoveryCodeRepository) {
        return new AdminUserService(
                userRepository,
                groupRepository,
                userAvatarRepository,
                authorityRepository,
                userAccessInvalidationService,
                accountLockService,
                passwordService,
                adminAuditEventService,
                userActionService,
                Mappers.getMapper(AdminUserMapper.class),
                Mappers.getMapper(AdminGroupMapper.class),
                recoveryCodeRepository,
                ldapFederationWriteService);
    }

    private static AuthorityEntity authority(Long id, String role) {
        AuthorityEntity authority = new AuthorityEntity();
        authority.setId(id);
        authority.setName(role);
        return authority;
    }

    private static UserRepository.GroupUserCount groupUserCount(Long groupId, long userCount) {
        return new UserRepository.GroupUserCount() {
            @Override
            public Long getGroupId() {
                return groupId;
            }

            @Override
            public long getUserCount() {
                return userCount;
            }
        };
    }

    private static UserEntity user(Long id, String username, String role) {
        return user(id, username, Set.of(role));
    }

    private static UserEntity user(Long id, String username, Set<String> roles) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setUsername(username);
        user.setEnabled(true);
        user.setAuthorities(
                roles.stream().map(role -> authority(null, role)).collect(Collectors.toSet()));
        return user;
    }

    private static UserAvatarRepository.AvatarVersion avatar(
            Long userId, String publicId, long epochMilli) {
        return new UserAvatarRepository.AvatarVersion() {
            @Override
            public Long getUserId() {
                return userId;
            }

            @Override
            public String getPublicId() {
                return publicId;
            }

            @Override
            public Instant getUpdatedAt() {
                return Instant.ofEpochMilli(epochMilli);
            }
        };
    }
}
