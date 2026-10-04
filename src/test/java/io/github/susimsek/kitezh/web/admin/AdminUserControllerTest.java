package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserAction;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminUserBulkAction;
import io.github.susimsek.kitezh.dto.admin.AdminUserBulkRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminUserEnabledRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminUserRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminWebAuthnCredentialLabelRequestDTO;
import io.github.susimsek.kitezh.dto.userprofile.UserProfileAttributesRequestDTO;
import io.github.susimsek.kitezh.service.UserProfileService;
import io.github.susimsek.kitezh.service.account.WebAuthnService;
import io.github.susimsek.kitezh.service.admin.AdminAvatarService;
import io.github.susimsek.kitezh.service.admin.AdminUserService;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.Authentication;

class AdminUserControllerTest {

    private final AdminUserService adminUserService = mock(AdminUserService.class);
    private final AdminAvatarService adminAvatarService = mock(AdminAvatarService.class);
    private final UserProfileService userProfileService = mock(UserProfileService.class);
    private final WebAuthnService webAuthnService = mock(WebAuthnService.class);
    private final Authentication authentication = mock(Authentication.class);
    private final AdminUserController controller =
            new AdminUserController(
                    adminUserService, adminAvatarService, userProfileService, webAuthnService);

    @Test
    void delegatesAllUserAdministrationEndpoints() {
        when(authentication.getName()).thenReturn("admin");
        UserEntity manageable = new UserEntity();
        manageable.setUsername("alice");
        when(adminUserService.requireManageableUser(7L, "admin")).thenReturn(manageable);
        PageRequest pageable = PageRequest.of(0, 20);

        controller.users("alice", true, pageable);
        controller.user(7L, authentication);
        controller.profileAttributes(7L, authentication);
        controller.updateProfileAttributes(
                7L,
                new UserProfileAttributesRequestDTO(Map.of("department", List.of("IT"))),
                authentication);
        controller.userGroups(7L, "engineering", pageable, authentication);
        controller.webAuthnCredentials(7L, pageable, authentication);
        controller.webAuthnCredential(7L, "credential", authentication);
        assertThat(
                        controller.renameWebAuthnCredential(
                                7L,
                                "credential",
                                new AdminWebAuthnCredentialLabelRequestDTO("Office laptop"),
                                authentication))
                .returns(204, response -> response.getStatusCode().value());
        assertThat(controller.deleteWebAuthnCredential(7L, "credential", authentication))
                .returns(204, response -> response.getStatusCode().value());

        AdminUserRequestDTO basicCreate =
                new AdminUserRequestDTO("alice", "Change-me12!", true, Set.of("ROLE_USER"));
        assertThat(controller.createUser(basicCreate, authentication).getStatusCode().value())
                .isEqualTo(201);
        AdminUserRequestDTO detailedCreate =
                new AdminUserRequestDTO(
                        "alice",
                        "Alice",
                        "Example",
                        "alice@example.test",
                        true,
                        "Change-me12!",
                        true,
                        true,
                        Set.of("ROLE_USER"));
        controller.createUser(detailedCreate, authentication);
        controller.createUser(
                new AdminUserRequestDTO(
                        "alice",
                        null,
                        "Example",
                        null,
                        false,
                        "Change-me12!",
                        false,
                        false,
                        Set.of("ROLE_USER")),
                authentication);
        controller.createUser(
                new AdminUserRequestDTO(
                        "alice",
                        null,
                        null,
                        "alice@example.test",
                        null,
                        "Change-me12!",
                        null,
                        null,
                        Set.of("ROLE_USER")),
                authentication);
        controller.createUser(
                new AdminUserRequestDTO(
                        "alice",
                        null,
                        null,
                        null,
                        null,
                        "Change-me12!",
                        true,
                        true,
                        Set.of("ROLE_USER")),
                authentication);
        controller.bulkOperate(
                new AdminUserBulkRequestDTO(List.of(7L), AdminUserBulkAction.DISABLE),
                authentication);
        controller.updateUser(7L, detailedCreate, authentication);
        controller.updateUser(
                7L,
                new AdminUserRequestDTO(
                        "alice", null, null, null, false, null, null, false, Set.of("ROLE_USER")),
                authentication);
        controller.updateAvatar(
                7L,
                new MockMultipartFile("file", "avatar.png", "image/png", new byte[] {1}),
                authentication);
        assertThat(controller.deleteAvatar(7L, authentication))
                .returns(204, response -> response.getStatusCode().value());

        AdminUserRequestDTO passwordOnly =
                new AdminUserRequestDTO(
                        "alice", null, null, null, null, "Change-me12!", null, null, null);
        controller.changePassword(7L, passwordOnly, authentication);
        AdminUserRequestDTO temporaryPassword =
                new AdminUserRequestDTO(
                        "alice", null, null, null, null, "Change-me12!", true, null, null);
        controller.changePassword(7L, temporaryPassword, authentication);
        assertThat(controller.resetTotp(7L, authentication))
                .returns(204, response -> response.getStatusCode().value());
        assertThat(controller.unlockUser(7L, authentication))
                .returns(204, response -> response.getStatusCode().value());
        assertThat(controller.deleteUser(7L, authentication))
                .returns(204, response -> response.getStatusCode().value());
        assertThat(
                        controller.setUserEnabled(
                                7L, new AdminUserEnabledRequestDTO(true), authentication))
                .returns(204, response -> response.getStatusCode().value());
        assertThat(
                        controller.executeActionsEmail(
                                7L,
                                3600L,
                                Set.of(UserAction.VERIFY_EMAIL),
                                Locale.ENGLISH,
                                authentication))
                .returns(204, response -> response.getStatusCode().value());
        assertThatThrownBy(
                        () ->
                                controller.executeActionsEmail(
                                        7L, null, Set.of(), Locale.ENGLISH, authentication))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(
                        () ->
                                controller.executeActionsEmail(
                                        7L, null, null, Locale.ENGLISH, authentication))
                .isInstanceOf(RuntimeException.class);
        assertThat(controller.sendVerifyEmail(7L, 3600L, Locale.ENGLISH, authentication))
                .returns(204, response -> response.getStatusCode().value());

        verify(userProfileService).attributes(7L);
        verify(userProfileService).saveAttributes(eq(7L), anyMap(), eq("admin"));
        verify(webAuthnService).credentials("alice", pageable);
        verify(webAuthnService).credential("alice", "credential");
        verify(webAuthnService).updateLabel("alice", "credential", "Office laptop", "admin");
        verify(webAuthnService).deleteForAdministrator("alice", "credential", "admin");
        verify(adminAvatarService).deleteAvatar(7L, "admin");
        verify(adminUserService, times(2))
                .executeActionsEmail(7L, UserAction.VERIFY_EMAIL, 3600L, Locale.ENGLISH, "admin");
    }
}
