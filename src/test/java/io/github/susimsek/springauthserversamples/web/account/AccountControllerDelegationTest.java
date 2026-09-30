package io.github.susimsek.springauthserversamples.web.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.dto.account.AccountAvatarDTO;
import io.github.susimsek.springauthserversamples.dto.account.AccountDeleteRequestDTO;
import io.github.susimsek.springauthserversamples.dto.account.AccountPasswordRequestDTO;
import io.github.susimsek.springauthserversamples.dto.account.AccountProfileRequestDTO;
import io.github.susimsek.springauthserversamples.dto.account.MfaCodeRequestDTO;
import io.github.susimsek.springauthserversamples.dto.account.WebAuthnCredentialLabelRequestDTO;
import io.github.susimsek.springauthserversamples.dto.userprofile.UserProfileAttributesRequestDTO;
import io.github.susimsek.springauthserversamples.service.UserProfileService;
import io.github.susimsek.springauthserversamples.service.account.AccountApplicationService;
import io.github.susimsek.springauthserversamples.service.account.AccountAvatarService;
import io.github.susimsek.springauthserversamples.service.account.AccountDeletionService;
import io.github.susimsek.springauthserversamples.service.account.AccountProfileService;
import io.github.susimsek.springauthserversamples.service.account.AccountSessionService;
import io.github.susimsek.springauthserversamples.service.account.MfaService;
import io.github.susimsek.springauthserversamples.service.account.RecoveryCodeService;
import io.github.susimsek.springauthserversamples.service.account.WebAuthnService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

class AccountControllerDelegationTest {

    private final AccountProfileService profileService = mock(AccountProfileService.class);
    private final UserProfileService userProfileService = mock(UserProfileService.class);
    private final AccountSessionService sessionService = mock(AccountSessionService.class);
    private final AccountApplicationService applicationService =
            mock(AccountApplicationService.class);
    private final AccountAvatarService avatarService = mock(AccountAvatarService.class);
    private final AccountDeletionService deletionService = mock(AccountDeletionService.class);
    private final MfaService mfaService = mock(MfaService.class);
    private final RecoveryCodeService recoveryCodeService = mock(RecoveryCodeService.class);
    private final WebAuthnService webAuthnService = mock(WebAuthnService.class);

    @Test
    void delegatesAccountAvatarEndpoints() {
        final var controller =
                new AccountController(
                        profileService,
                        userProfileService,
                        sessionService,
                        applicationService,
                        avatarService,
                        deletionService,
                        mfaService,
                        recoveryCodeService);
        final Authentication authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        "alice", "ignored", java.util.List.of());
        var avatar = new AccountAvatarDTO("/avatars/alice?v=1");
        var file = new MockMultipartFile("file", "avatar.png", "image/png", new byte[] {1});
        when(avatarService.avatar("alice")).thenReturn(avatar);
        when(avatarService.updateAvatar("alice", file)).thenReturn(avatar);

        assertThat(controller.avatar(authentication)).isSameAs(avatar);
        assertThat(controller.updateAvatar(authentication, file)).isSameAs(avatar);
        assertThat(controller.deleteAvatar(authentication).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        verify(avatarService).avatar("alice");
        verify(avatarService).updateAvatar("alice", file);
        verify(avatarService).deleteAvatar("alice");
    }

    @Test
    void delegatesProfileSessionMfaApplicationAndPasskeyEndpoints() {
        final var controller =
                new AccountController(
                        profileService,
                        userProfileService,
                        sessionService,
                        applicationService,
                        avatarService,
                        deletionService,
                        mfaService,
                        recoveryCodeService,
                        webAuthnService);
        final Authentication authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        "alice", "ignored", java.util.List.of());
        var jwt = mock(org.springframework.security.oauth2.jwt.Jwt.class);
        when(jwt.getClaimAsString("sid")).thenReturn("sid-1");
        when(jwt.getClaimAsInstant("auth_time"))
                .thenReturn(java.time.Instant.parse("2026-01-01T00:00:00Z"));
        final var pageable = org.springframework.data.domain.PageRequest.of(0, 20);
        final var profileRequest = mock(AccountProfileRequestDTO.class);
        var attributesRequest = mock(UserProfileAttributesRequestDTO.class);
        when(attributesRequest.attributes())
                .thenReturn(java.util.Map.of("department", java.util.List.of("security")));
        var passwordRequest = mock(AccountPasswordRequestDTO.class);
        when(passwordRequest.currentPassword()).thenReturn("old");
        when(passwordRequest.newPassword()).thenReturn("new");
        var codeRequest = mock(MfaCodeRequestDTO.class);
        when(codeRequest.code()).thenReturn("123456");
        var labelRequest = mock(WebAuthnCredentialLabelRequestDTO.class);
        when(labelRequest.label()).thenReturn("Laptop");

        controller.mfa(authentication);
        controller.recoveryCodes(authentication);
        controller.generateRecoveryCodes(authentication);
        controller.setupMfa(authentication);
        controller.enableMfa(authentication, codeRequest);
        controller.disableMfa(authentication, codeRequest);
        controller.profile(authentication);
        controller.updateProfile(authentication, jwt, profileRequest);
        controller.profileAttributes(authentication);
        controller.updateProfileAttributes(authentication, attributesRequest);
        controller.changePassword(authentication, passwordRequest);
        controller.sendVerifyEmail(authentication, java.util.Locale.ENGLISH);
        controller.sessions(authentication, jwt, pageable);
        controller.deleteOtherSessions(authentication, jwt);
        controller.deleteSession(authentication, "session-1");
        controller.applications(authentication, pageable);
        controller.revokeApplication(authentication, "client-1");
        controller.webAuthnCredentials(authentication, pageable);
        controller.webAuthnCredential(authentication, "credential-1");
        controller.updateWebAuthnCredential(authentication, "credential-1", labelRequest);
        controller.deleteWebAuthnCredential(authentication, "credential-1");
        controller.deleteAccount(authentication, mock(AccountDeleteRequestDTO.class));

        verify(profileService).profile("alice");
        verify(profileService).updateProfile(eq("alice"), eq(profileRequest), any());
        verify(userProfileService).saveAttributes("alice", attributesRequest.attributes(), "alice");
        verify(sessionService).deleteSession("alice", "session-1");
        verify(webAuthnService).delete("alice", "credential-1");
    }
}
