package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.SocialIdentityEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.SocialLinkDTO;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.SocialIdentityRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.UserAccessInvalidationService;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class SocialLoginServiceTest {

    @org.junit.jupiter.api.BeforeEach
    void enableSocialProviders() {
        lenient().when(loginSettingsService.isSocialProviderEnabled(anyString())).thenReturn(true);
    }

    @Mock private UserRepository userRepository;
    @Mock private SocialIdentityRepository socialIdentityRepository;
    @Mock private AuthorityRepository authorityRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private LoginSettingsService loginSettingsService;
    @Mock private SocialProviderSettingsService socialProviderSettingsService;
    @Mock private SocialIdentityMapperService socialIdentityMapperService;
    @Mock private ObjectMapper objectMapper;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;
    @Mock private AdminAuditEventService auditEventService;

    @Test
    void createsUserWithDefaultRoleAndStableSocialIdentity() {
        AuthorityEntity userRole = new AuthorityEntity(2L, AuthoritiesConstants.USER);
        when(socialIdentityRepository.findByProviderAndSubject("google", "google-subject"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("ada@example.test")).thenReturn(Optional.empty());
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(userRole));
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-random-password");
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity user = invocation.getArgument(0);
                            user.setId(42L);
                            return user;
                        });

        String username = service().findOrCreate(authentication());

        assertThat(username).startsWith("social_google_");
        ArgumentCaptor<UserEntity> userCaptor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(userCaptor.capture());
        UserEntity created = userCaptor.getValue();
        assertThat(created.getEmail()).isEqualTo("ada@example.test");
        assertThat(created.isEmailVerified()).isTrue();
        assertThat(created.getPictureUrl()).isEqualTo("https://images.example.test/ada.jpg");
        assertThat(created.getAuthorities()).containsExactly(userRole);
        ArgumentCaptor<SocialIdentityEntity> identityCaptor =
                ArgumentCaptor.forClass(SocialIdentityEntity.class);
        verify(socialIdentityRepository).save(identityCaptor.capture());
        assertThat(identityCaptor.getValue().getProvider()).isEqualTo("google");
        assertThat(identityCaptor.getValue().getSubject()).isEqualTo("google-subject");
        assertThat(identityCaptor.getValue().getUser()).isSameAs(created);
    }

    @Test
    void rejectsNewSocialUserWhenTheDefaultAuthorityIsMissing() {
        when(socialIdentityRepository.findByProviderAndSubject("google", "google-subject"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("ada@example.test")).thenReturn(Optional.empty());
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().findOrCreate(authentication()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("The default user authority is not configured");
    }

    @Test
    void doesNotTrustAnUnverifiedSocialEmail() {
        AuthorityEntity userRole = new AuthorityEntity(2L, AuthoritiesConstants.USER);
        when(socialIdentityRepository.findByProviderAndSubject("google", "google-subject"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("ada@example.test")).thenReturn(Optional.empty());
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(userRole));
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-random-password");
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity user = invocation.getArgument(0);
                            user.setId(42L);
                            return user;
                        });

        OAuth2User user =
                new DefaultOAuth2User(
                        java.util.Set.of(new SimpleGrantedAuthority("ROLE_OAUTH2_USER")),
                        Map.of(
                                "sub", "google-subject",
                                "email", "ada@example.test"),
                        "sub");
        OAuth2AuthenticationToken unverified =
                new OAuth2AuthenticationToken(user, user.getAuthorities(), "google");

        service().findOrCreate(unverified);

        ArgumentCaptor<UserEntity> userCaptor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().isEmailVerified()).isFalse();
    }

    @Test
    void trustsEmailWhenProviderPolicyAllowsIt() {
        AuthorityEntity userRole = new AuthorityEntity(2L, AuthoritiesConstants.USER);
        when(socialProviderSettingsService.provider("google"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "google",
                                "google",
                                "google-id",
                                "google-secret",
                                true,
                                false,
                                false,
                                true,
                                false,
                                "sub,email",
                                false,
                                false,
                                10,
                                "always"));
        when(socialIdentityRepository.findByProviderAndSubject("google", "google-subject"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("ada@example.test")).thenReturn(Optional.empty());
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(userRole));
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-random-password");
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity user = invocation.getArgument(0);
                            user.setId(42L);
                            return user;
                        });

        OAuth2User user =
                new DefaultOAuth2User(
                        java.util.Set.of(new SimpleGrantedAuthority("ROLE_OAUTH2_USER")),
                        Map.of("sub", "google-subject", "email", "ada@example.test"),
                        "sub");
        service()
                .findOrCreate(new OAuth2AuthenticationToken(user, user.getAuthorities(), "google"));

        ArgumentCaptor<UserEntity> userCaptor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().isEmailVerified()).isTrue();
    }

    @Test
    void rejectsAuthenticationWhenAnEssentialClaimIsMissing() {
        when(socialProviderSettingsService.provider("google"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "google",
                                "google",
                                "google-id",
                                "google-secret",
                                true,
                                false,
                                false,
                                false,
                                false,
                                "sub,email",
                                false,
                                false,
                                10,
                                "always"));
        OAuth2User user =
                new DefaultOAuth2User(
                        java.util.Set.of(new SimpleGrantedAuthority("ROLE_OAUTH2_USER")),
                        Map.of("sub", "google-subject"),
                        "sub");

        assertThatThrownBy(
                        () ->
                                service()
                                        .findOrCreate(
                                                new OAuth2AuthenticationToken(
                                                        user, user.getAuthorities(), "google")))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("required claim");
    }

    @Test
    void reusesUserForPreviouslyLinkedSocialIdentity() {
        UserEntity user = new UserEntity();
        user.setUsername("social_google_existing");
        when(socialIdentityRepository.findByProviderAndSubject("google", "google-subject"))
                .thenReturn(
                        Optional.of(new SocialIdentityEntity("google", "google-subject", user)));

        assertThat(service().findOrCreate(authentication())).isEqualTo("social_google_existing");
        verify(userRepository).save(user);
        assertThat(user.getPictureUrl()).isEqualTo("https://images.example.test/ada.jpg");
        verify(socialIdentityRepository, never()).save(any(SocialIdentityEntity.class));
    }

    @Test
    void forceSyncModeUpdatesExistingUserProfile() {
        UserEntity user = new UserEntity();
        user.setUsername("social_google_existing");
        user.setFirstName("Old");
        user.setLastName("Name");
        user.setEmail("old@example.test");
        when(socialProviderSettingsService.syncMode("google")).thenReturn("force");
        when(socialIdentityRepository.findByProviderAndSubject("google", "google-subject"))
                .thenReturn(
                        Optional.of(new SocialIdentityEntity("google", "google-subject", user)));

        assertThat(service().findOrCreate(authentication())).isEqualTo("social_google_existing");
        assertThat(user.getFirstName()).isEqualTo("Ada");
        assertThat(user.getLastName()).isEqualTo("Lovelace");
        assertThat(user.getEmail()).isEqualTo("ada@example.test");
        assertThat(user.getPictureUrl()).isEqualTo("https://images.example.test/ada.jpg");
        verify(userRepository).save(user);
    }

    @Test
    void readOnlySyncModeDoesNotUpdateExistingProfile() {
        UserEntity user = new UserEntity();
        user.setUsername("social_google_existing");
        user.setFirstName("Old");
        when(socialProviderSettingsService.syncMode("google")).thenReturn("read_only");
        when(socialIdentityRepository.findByProviderAndSubject("google", "google-subject"))
                .thenReturn(
                        Optional.of(new SocialIdentityEntity("google", "google-subject", user)));

        assertThat(service().findOrCreate(authentication())).isEqualTo("social_google_existing");

        assertThat(user.getFirstName()).isEqualTo("Old");
        verify(userRepository, never()).save(any(UserEntity.class));
    }

    @Test
    void createsSocialUserWithoutEmailUsingNameFallback() {
        AuthorityEntity userRole = new AuthorityEntity(2L, AuthoritiesConstants.USER);
        when(socialIdentityRepository.findByProviderAndSubject("google", "name-only"))
                .thenReturn(Optional.empty());
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(userRole));
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-random-password");
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity user = invocation.getArgument(0);
                            user.setId(44L);
                            return user;
                        });

        service()
                .findOrCreate(
                        authentication(
                                "google", Map.of("sub", "name-only", "name", "Ada Lovelace")));

        ArgumentCaptor<UserEntity> userCaptor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getEmail()).isNull();
        assertThat(userCaptor.getValue().getFirstName()).isEqualTo("Ada Lovelace");
    }

    @Test
    void fallsBackToIdAndNormalizesEmailAndAvatarClaims() {
        AuthorityEntity userRole = new AuthorityEntity(2L, AuthoritiesConstants.USER);
        when(socialProviderSettingsService.provider("google"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "google",
                                "google",
                                "google-id",
                                "google-secret",
                                true,
                                false,
                                false,
                                false,
                                false,
                                "id",
                                false,
                                false,
                                0,
                                "always"));
        when(socialIdentityRepository.findByProviderAndSubject("google", "fallback-subject"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("ada@example.test")).thenReturn(Optional.empty());
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(userRole));
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-random-password");
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity user = invocation.getArgument(0);
                            user.setId(43L);
                            return user;
                        });

        OAuth2AuthenticationToken token =
                authentication(
                        "google",
                        Map.of(
                                "sub",
                                " ",
                                "id",
                                "fallback-subject",
                                "email",
                                "ADA@EXAMPLE.TEST",
                                "email_verified",
                                "false",
                                "avatar_url",
                                "https://images.example.test/avatar.png"));

        service().findOrCreate(token);

        ArgumentCaptor<UserEntity> userCaptor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getEmail()).isEqualTo("ada@example.test");
        assertThat(userCaptor.getValue().isEmailVerified()).isFalse();
        assertThat(userCaptor.getValue().getPictureUrl())
                .isEqualTo("https://images.example.test/avatar.png");
    }

    @Test
    void storesMappedClaimsAndWrapsMapperSerializationFailures() {
        UserEntity user = new UserEntity();
        user.setUsername("social_google_existing");
        SocialIdentityEntity identity = new SocialIdentityEntity("google", "google-subject", user);
        when(socialIdentityRepository.findByProviderAndSubject("google", "google-subject"))
                .thenReturn(Optional.of(identity));
        when(socialIdentityMapperService.apply(
                        anyString(),
                        any(),
                        any(UserEntity.class),
                        org.mockito.ArgumentMatchers.eq(false),
                        org.mockito.ArgumentMatchers.eq(false),
                        org.mockito.ArgumentMatchers.isNull()))
                .thenReturn(Map.of("department", Map.of("value", "security")));
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"department\":{}}");

        assertThat(service().findOrCreate(authentication())).isEqualTo("social_google_existing");
        assertThat(identity.getMappedClaims()).isEqualTo("{\"department\":{}}");

        when(objectMapper.writeValueAsString(any()))
                .thenThrow(mock(tools.jackson.core.JacksonException.class));
        assertThatThrownBy(() -> service().findOrCreate(authentication()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("claims could not be stored");
    }

    @Test
    void ignoresUnsafeSocialPictures() {
        UserEntity user = new UserEntity();
        user.setUsername("social_google_existing");
        when(socialIdentityRepository.findByProviderAndSubject("google", "google-subject"))
                .thenReturn(
                        Optional.of(new SocialIdentityEntity("google", "google-subject", user)));

        assertThat(
                        service()
                                .findOrCreate(
                                        authentication(
                                                "google",
                                                Map.of(
                                                        "sub",
                                                        "google-subject",
                                                        "picture",
                                                        "http://images.example.test/avatar.png"))))
                .isEqualTo("social_google_existing");
        verify(userRepository, never()).save(any(UserEntity.class));

        for (String picture :
                java.util.List.of(
                        "https:///avatar.png",
                        "https://user:secret@images.example.test/avatar.png",
                        "https://images.example.test/avatar.png#fragment",
                        "not a uri")) {
            service()
                    .findOrCreate(
                            authentication(
                                    "google", Map.of("sub", "google-subject", "picture", picture)));
        }
        verify(userRepository, never()).save(any(UserEntity.class));
    }

    @Test
    void doesNotSilentlyLinkSocialIdentityToExistingEmailAccount() {
        UserEntity existing = new UserEntity();
        existing.setUsername("ada");
        when(socialIdentityRepository.findByProviderAndSubject("google", "google-subject"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("ada@example.test"))
                .thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service().findOrCreate(authentication()))
                .isInstanceOf(
                        org.springframework.security.oauth2.core.OAuth2AuthenticationException
                                .class)
                .hasMessageContaining("already exists");
        verify(userRepository, never()).save(any(UserEntity.class));
    }

    @Test
    void linksPendingSocialIdentityToExistingLocalAccount() {
        UserEntity existing = new UserEntity();
        existing.setId(42L);
        existing.setUsername("ada");
        when(userRepository.findForLoginUpdate("ada")).thenReturn(Optional.of(existing));
        when(socialIdentityRepository.findByProviderAndSubject("github", "123"))
                .thenReturn(Optional.empty());

        service().linkPending("ada", Map.of("provider", "github", "subject", "123"));

        ArgumentCaptor<SocialIdentityEntity> identityCaptor =
                ArgumentCaptor.forClass(SocialIdentityEntity.class);
        verify(socialIdentityRepository).save(identityCaptor.capture());
        assertThat(identityCaptor.getValue().getProvider()).isEqualTo("github");
        assertThat(identityCaptor.getValue().getSubject()).isEqualTo("123");
        assertThat(identityCaptor.getValue().getUser()).isSameAs(existing);
    }

    @Test
    void linkingAlreadyLinkedIdentityIsIdempotentForSameLocalAccount() {
        UserEntity existing = new UserEntity();
        existing.setId(42L);
        existing.setUsername("ada");
        SocialIdentityEntity identity = new SocialIdentityEntity("github", "123", existing);
        when(userRepository.findForLoginUpdate("ada")).thenReturn(Optional.of(existing));
        when(socialIdentityRepository.findByProviderAndSubject("github", "123"))
                .thenReturn(Optional.of(identity));

        service().linkPending("ada", Map.of("provider", "github", "subject", "123"));

        verify(socialIdentityRepository, never()).save(any(SocialIdentityEntity.class));
    }

    @Test
    void rejectsLinkingAnotherIdentityFromSameProviderWithoutOverrideFlow() {
        UserEntity existing = new UserEntity();
        existing.setId(42L);
        existing.setUsername("ada");
        when(userRepository.findForLoginUpdate("ada")).thenReturn(Optional.of(existing));
        when(socialIdentityRepository.findByProviderAndSubject("github", "456"))
                .thenReturn(Optional.empty());
        when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "github"))
                .thenReturn(java.util.List.of(new SocialIdentityEntity("github", "123", existing)));

        assertThatThrownBy(
                        () ->
                                service()
                                        .linkPending(
                                                "ada",
                                                Map.of("provider", "github", "subject", "456")))
                .isInstanceOf(
                        org.springframework.security.oauth2.core.OAuth2AuthenticationException
                                .class)
                .hasMessageContaining("already linked");
        verify(socialIdentityRepository, never()).save(any(SocialIdentityEntity.class));
    }

    @Test
    void excludesDisabledProviderFromStoredConfiguration() {
        when(socialProviderSettingsService.configuredProviders())
                .thenReturn(
                        java.util.List.of(
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "google", "google-id", "google-secret"),
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "github", "github-id", "github-secret"),
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "linkedin", "linkedin-id", "linkedin-secret"),
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "microsoft", "microsoft-id", "microsoft-secret")));
        when(loginSettingsService.isSocialProviderEnabled("github")).thenReturn(false);
        assertThat(service().configuredProviders())
                .containsExactly("google", "linkedin", "microsoft");
    }

    @Test
    void listsEnabledProvidersIncludingUnconfiguredProviders() {
        when(socialProviderSettingsService.effectiveProviders())
                .thenReturn(
                        java.util.List.of(
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "google", "google-id", "google-secret"),
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "microsoft", "", "")));
        assertThat(service().availableProviders())
                .extracting(provider -> provider.provider() + ":" + provider.configured())
                .containsExactly("google:true", "microsoft:false");
    }

    @Test
    void exposesSamlProviderTypeForLoginRouting() {
        SocialProviderSettingsService.ProviderCredentials provider = mock();
        when(provider.registrationId()).thenReturn("saml-e2e");
        when(provider.alias()).thenReturn("saml-e2e");
        when(provider.providerType()).thenReturn("saml");
        when(provider.iconKey()).thenReturn("generic");
        when(socialProviderSettingsService.effectiveProviders())
                .thenReturn(java.util.List.of(provider));

        assertThat(service().availableProviders())
                .singleElement()
                .satisfies(
                        result -> {
                            assertThat(result.provider()).isEqualTo("saml-e2e");
                            assertThat(result.providerType()).isEqualTo("saml");
                            assertThat(result.configured()).isTrue();
                        });
    }

    @Test
    void hidesProvidersWhenProviderIsDisabled() {
        when(socialProviderSettingsService.effectiveProviders())
                .thenReturn(
                        java.util.List.of(
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "google",
                                        "google",
                                        "Google",
                                        "google",
                                        "google-id",
                                        "google-secret",
                                        false,
                                        false,
                                        false,
                                        false,
                                        false,
                                        "sub",
                                        false,
                                        false,
                                        0,
                                        "always",
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        "client_secret_basic",
                                        "openid",
                                        "sub",
                                        "google",
                                        false,
                                        false)));
        when(socialProviderSettingsService.provider("google"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "google",
                                "google",
                                "google-id",
                                "google-secret",
                                false,
                                false,
                                false,
                                0,
                                "always"));

        assertThat(service().availableProviders()).isEmpty();
    }

    @Test
    void listsEnabledSocialLinksIncludingUnconfiguredMicrosoft() {
        when(socialProviderSettingsService.effectiveProviders())
                .thenReturn(
                        java.util.List.of(
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "google", "google-id", "google-secret"),
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "microsoft", "", "")));
        when(socialIdentityRepository.findAllByUserUsername("ada")).thenReturn(java.util.List.of());

        assertThat(service().socialLinks("ada"))
                .extracting(link -> link.provider() + ":" + link.linked() + ":" + link.configured())
                .containsExactly("google:false:true", "microsoft:false:false");
    }

    @Test
    void keepsLinkedProviderVisibleWhenAdministratorDisablesIt() {
        when(socialProviderSettingsService.effectiveProviders())
                .thenReturn(
                        java.util.List.of(
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "github",
                                        "github",
                                        "github-id",
                                        "github-secret",
                                        false,
                                        false,
                                        false,
                                        0,
                                        "always")));
        UserEntity user = new UserEntity();
        user.setUsername("ada");
        when(socialIdentityRepository.findAllByUserUsername("ada"))
                .thenReturn(java.util.List.of(new SocialIdentityEntity("github", "123", user)));
        when(socialProviderSettingsService.provider("github"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "github",
                                "github",
                                "github-id",
                                "github-secret",
                                false,
                                false,
                                false,
                                0,
                                "always"));

        assertThat(service().socialLinks("ada"))
                .extracting(
                        link ->
                                link.provider()
                                        + ":"
                                        + link.linked()
                                        + ":"
                                        + link.configured()
                                        + ":"
                                        + link.enabled())
                .containsExactly("github:true:true:false");
    }

    @Test
    void rejectsAuthenticationWhenProviderWasDisabledAfterLoginPageLoad() {
        when(socialProviderSettingsService.provider("google"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "google",
                                "google",
                                "google-id",
                                "google-secret",
                                false,
                                false,
                                false,
                                0,
                                "always"));

        assertThatThrownBy(() -> service().findOrCreate(authentication()))
                .isInstanceOf(
                        org.springframework.security.oauth2.core.OAuth2AuthenticationException
                                .class)
                .hasMessageContaining("disabled");
        verify(socialIdentityRepository, never())
                .findByProviderAndSubject(anyString(), anyString());
    }

    @Test
    void rejectsPublicLoginForAccountLinkingOnlyProvider() {
        when(socialProviderSettingsService.provider("google"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "google",
                                "google",
                                "google-id",
                                "google-secret",
                                true,
                                false,
                                true,
                                10,
                                "always"));

        assertThatThrownBy(() -> service().findOrCreate(authentication()))
                .isInstanceOf(
                        org.springframework.security.oauth2.core.OAuth2AuthenticationException
                                .class)
                .hasMessageContaining("disabled for public sign-in");
        verify(socialIdentityRepository, never())
                .findByProviderAndSubject(anyString(), anyString());
    }

    @Test
    void usesAliasesAndGuiOrderForPublicProviders() {
        when(socialProviderSettingsService.effectiveProviders())
                .thenReturn(
                        java.util.List.of(
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "google",
                                        "z-login",
                                        "google-id",
                                        "google-secret",
                                        true,
                                        false,
                                        false,
                                        20,
                                        "always"),
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "github",
                                        "a-login",
                                        "github-id",
                                        "github-secret",
                                        true,
                                        false,
                                        false,
                                        10,
                                        "always")));

        assertThat(service().availableProviders())
                .extracting(provider -> provider.provider() + ":" + provider.configured())
                .containsExactly("a-login:true", "z-login:true");
    }

    @Test
    void unlinksAllIdentitiesForProviderAndInvalidatesAccess() {
        UserEntity user = new UserEntity();
        user.setUsername("ada");
        SocialIdentityEntity identity = new SocialIdentityEntity("github", "123", user);
        when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "github"))
                .thenReturn(java.util.List.of(identity));

        service().unlink("ada", "github");

        verify(socialIdentityRepository).deleteAll(java.util.List.of(identity));
        verify(userAccessInvalidationService).invalidate("ada");
        verify(auditEventService)
                .record("account.social_link.deleted", "social_identity", "ada:github");
    }

    @Test
    void exposesProviderPolicyFlagsAndCanonicalProviderChecks() {
        when(socialProviderSettingsService.provider("google"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "google",
                                "google",
                                "google-id",
                                "google-secret",
                                true,
                                true,
                                false,
                                true,
                                true,
                                "sub",
                                false,
                                false,
                                10,
                                "always"));

        assertThat(service().requiresShortStateParameter("google")).isFalse();
        assertThat(service().providerRequiresMfa("google")).isTrue();
        assertThat(service().isLinkedInProvider("linkedin")).isTrue();
        assertThat(service().isLinkedInProvider("unknown")).isFalse();
        assertThat(service().requiresShortStateParameter("unknown")).isFalse();
        assertThat(service().providerRequiresMfa("unknown")).isFalse();
    }

    @Test
    void handlesGlobalProviderDisablementAndNullProviderNames() {
        assertThat(service().isProviderEnabled(null)).isFalse();
        when(loginSettingsService.isSocialProviderEnabled("google")).thenReturn(false);

        assertThat(service().isProviderEnabled("google")).isFalse();
        assertThat(service().isProviderLoginAllowed("google")).isFalse();
        assertThat(service().requiresShortStateParameter(null)).isFalse();
        assertThat(service().providerRequiresMfa(null)).isFalse();
    }

    @Test
    void linksExistingAccountAfterProviderValidation() {
        UserEntity existing = new UserEntity();
        existing.setId(42L);
        existing.setUsername("ada");
        SocialIdentityEntity identity = new SocialIdentityEntity("github", "123", existing);
        when(userRepository.findForLoginUpdate("ada")).thenReturn(Optional.of(existing));
        when(socialIdentityRepository.findByProviderAndSubject("github", "123"))
                .thenReturn(Optional.empty(), Optional.of(identity));
        when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "github"))
                .thenReturn(java.util.List.of());

        assertThat(service().linkExisting("ada", "github", authentication("github", "123")))
                .isEqualTo("ada");
        verify(socialIdentityRepository, times(2)).save(any(SocialIdentityEntity.class));
    }

    @Test
    void rejectsLinkWhenTheLocalAccountOrPersistedIdentityCannotBeFound() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .linkPending(
                                                "missing",
                                                Map.of("provider", "github", "subject", "123")))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("local account could not be found");

        UserEntity existing = new UserEntity();
        existing.setId(42L);
        existing.setUsername("ada");
        when(userRepository.findForLoginUpdate("ada")).thenReturn(Optional.of(existing));
        when(socialIdentityRepository.findByProviderAndSubject("github", "123"))
                .thenReturn(Optional.empty());
        when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "github"))
                .thenReturn(java.util.List.of());
        assertThatThrownBy(
                        () ->
                                service()
                                        .linkExisting(
                                                "ada", "github", authentication("github", "123")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("The social identity link was not persisted");

        when(userRepository.findForLoginUpdate("ada")).thenReturn(Optional.of(existing));
        when(socialIdentityRepository.findByProviderAndSubject("github", "456"))
                .thenReturn(Optional.empty());
        when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "github"))
                .thenReturn(java.util.List.of());
        assertThatThrownBy(
                        () ->
                                service()
                                        .linkPending(
                                                "ada",
                                                Map.of(
                                                        "provider",
                                                        "github",
                                                        "subject",
                                                        "456",
                                                        "attributes",
                                                        Map.of("sub", "456"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("The social identity link was not persisted");
    }

    @Test
    void rejectsMismatchedOrMissingPendingProviderLinks() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .linkExisting(
                                                "ada", "github", authentication("google", "123")))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("did not match");
        assertThatThrownBy(() -> service().linkPending("ada", Map.of("provider", "github")))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("invalid");

        assertThatThrownBy(
                        () -> service().linkExisting("ada", null, authentication("github", "123")))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("did not match");
    }

    @Test
    void usesConfiguredProviderForUnlinkAndCoversProviderFlags() {
        SocialProviderSettingsService.ProviderCredentials configured =
                advancedProvider("github", true, false, false, false);
        when(socialProviderSettingsService.provider("GitHub")).thenReturn(configured);
        UserEntity user = new UserEntity();
        user.setUsername("ada");
        SocialIdentityEntity identity = new SocialIdentityEntity("github", "123", user);
        when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "github"))
                .thenReturn(java.util.List.of(identity));

        service().unlink("ada", "GitHub");

        verify(socialIdentityRepository).deleteAll(java.util.List.of(identity));
        assertThat(service().requiresShortStateParameter("GitHub")).isTrue();
        assertThat(service().providerRequiresMfa("GitHub")).isFalse();
    }

    @Test
    void acceptsDefaultRequiredClaimsAndCaseSensitiveMapperConfiguration() {
        AuthorityEntity userRole = new AuthorityEntity(2L, AuthoritiesConstants.USER);
        SocialProviderSettingsService.ProviderCredentials configured =
                advancedProvider("google", true, true, false, true);
        when(socialProviderSettingsService.provider("google")).thenReturn(configured);
        when(socialIdentityRepository.findByProviderAndSubject("google", "configured"))
                .thenReturn(Optional.empty());
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(userRole));
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-random-password");
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity user = invocation.getArgument(0);
                            user.setId(45L);
                            return user;
                        });
        when(socialIdentityMapperService.apply(
                        org.mockito.ArgumentMatchers.eq("google"),
                        org.mockito.ArgumentMatchers.eq(Map.of("sub", "configured")),
                        any(UserEntity.class),
                        org.mockito.ArgumentMatchers.eq(true),
                        org.mockito.ArgumentMatchers.eq(true),
                        org.mockito.ArgumentMatchers.isNull()))
                .thenReturn(Map.of());

        service().findOrCreate(authentication("google", Map.of("sub", "configured")));

        verify(socialIdentityMapperService)
                .apply(
                        org.mockito.ArgumentMatchers.eq("google"),
                        org.mockito.ArgumentMatchers.eq(Map.of("sub", "configured")),
                        any(UserEntity.class),
                        org.mockito.ArgumentMatchers.eq(true),
                        org.mockito.ArgumentMatchers.eq(true),
                        org.mockito.ArgumentMatchers.isNull());
    }

    @Test
    void fillsPictureFromFallbackClaimAndHandlesMissingPicture() {
        UserEntity user = new UserEntity();
        user.setUsername("social_google_existing");
        when(socialIdentityRepository.findByProviderAndSubject("google", "fallback-picture"))
                .thenReturn(
                        Optional.of(new SocialIdentityEntity("google", "fallback-picture", user)));

        service()
                .findOrCreate(
                        authentication(
                                "google",
                                Map.of(
                                        "sub",
                                        "fallback-picture",
                                        "picture",
                                        " ",
                                        "avatar_url",
                                        "https://images.example.test/avatar.png")));

        assertThat(user.getPictureUrl()).isEqualTo("https://images.example.test/avatar.png");
        verify(userRepository).save(user);

        UserEntity blankPictureUser = new UserEntity();
        blankPictureUser.setUsername("social_google_blank");
        blankPictureUser.setPictureUrl(" ");
        when(socialIdentityRepository.findByProviderAndSubject("google", "no-picture"))
                .thenReturn(
                        Optional.of(
                                new SocialIdentityEntity(
                                        "google", "no-picture", blankPictureUser)));

        service().findOrCreate(authentication("google", Map.of("sub", "no-picture")));

        verify(userRepository).save(user);
        verify(userRepository, times(1)).save(any(UserEntity.class));
    }

    @Test
    void handlesStringEmailVerificationAndMalformedPicturesDuringProfileSync() {
        UserEntity user = new UserEntity();
        user.setUsername("social_google_sync");
        user.setEmailVerified(true);
        SocialIdentityEntity identity = new SocialIdentityEntity("google", "sync", user);
        when(socialIdentityRepository.findByProviderAndSubject("google", "sync"))
                .thenReturn(Optional.of(identity));
        when(socialProviderSettingsService.syncMode("google")).thenReturn("force");

        service()
                .findOrCreate(
                        authentication(
                                "google",
                                Map.of(
                                        "sub",
                                        "sync",
                                        "email",
                                        "ada@example.test",
                                        "email_verified",
                                        "false",
                                        "picture",
                                        "https://[")));

        assertThat(user.isEmailVerified()).isFalse();
        assertThat(user.getEmail()).isEqualTo("ada@example.test");
        verify(userRepository).save(user);
    }

    @Test
    void appliesAttributesWhenCompletingPendingLink() {
        UserEntity existing = new UserEntity();
        existing.setId(42L);
        existing.setUsername("ada");
        SocialIdentityEntity identity = new SocialIdentityEntity("github", "123", existing);
        when(userRepository.findForLoginUpdate("ada")).thenReturn(Optional.of(existing));
        when(socialIdentityRepository.findByProviderAndSubject("github", "123"))
                .thenReturn(Optional.empty(), Optional.of(identity));
        when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "github"))
                .thenReturn(java.util.List.of());

        service()
                .linkPending(
                        "ada",
                        Map.of(
                                "provider",
                                "github",
                                "subject",
                                "123",
                                "attributes",
                                Map.of("sub", "123", "picture", "https://example.test/a")));

        verify(socialIdentityRepository, times(2)).save(any(SocialIdentityEntity.class));
    }

    @Test
    void rejectsLinksForDisabledUnknownOrAlreadyLinkedAccounts() {
        when(loginSettingsService.isSocialProviderEnabled("github")).thenReturn(false);
        assertThatThrownBy(
                        () ->
                                service()
                                        .linkPending(
                                                "ada",
                                                Map.of("provider", "github", "subject", "123")))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("disabled");

        assertThatThrownBy(() -> service().unlink("ada", "unsupported"))
                .isInstanceOf(ApiException.class);

        when(loginSettingsService.isSocialProviderEnabled("github")).thenReturn(true);
        UserEntity another = new UserEntity();
        another.setId(99L);
        UserEntity existing = new UserEntity();
        existing.setId(42L);
        existing.setUsername("ada");
        when(userRepository.findForLoginUpdate("ada")).thenReturn(Optional.of(existing));
        when(socialIdentityRepository.findByProviderAndSubject("github", "123"))
                .thenReturn(Optional.of(new SocialIdentityEntity("github", "123", another)));
        assertThatThrownBy(
                        () ->
                                service()
                                        .linkPending(
                                                "ada",
                                                Map.of("provider", "github", "subject", "123")))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("another local account");
    }

    @Test
    void handlesUnlinkWhenNoIdentityExists() {
        when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "github"))
                .thenReturn(java.util.List.of());

        assertThatThrownBy(() -> service().unlink("ada", "github"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void filtersAccountConsoleVisibilityPolicies() {
        when(socialProviderSettingsService.effectiveProviders())
                .thenReturn(
                        java.util.List.of(
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "google",
                                        "google",
                                        "google-id",
                                        "google-secret",
                                        true,
                                        false,
                                        false,
                                        0,
                                        "never"),
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "github",
                                        "github",
                                        "github-id",
                                        "github-secret",
                                        true,
                                        false,
                                        false,
                                        0,
                                        "when-linked"),
                                new SocialProviderSettingsService.ProviderCredentials(
                                        "linkedin", "linkedin-id", "linkedin-secret")));
        UserEntity user = new UserEntity();
        user.setUsername("ada");
        when(socialIdentityRepository.findAllByUserUsername("ada"))
                .thenReturn(java.util.List.of(new SocialIdentityEntity("github", "123", user)));

        assertThat(service().socialLinks("ada"))
                .extracting(SocialLinkDTO::provider)
                .containsExactly("github", "linkedin");
    }

    private SocialLoginService service() {
        return new SocialLoginService(
                userRepository,
                socialIdentityRepository,
                authorityRepository,
                passwordEncoder,
                loginSettingsService,
                socialProviderSettingsService,
                socialIdentityMapperService,
                objectMapper,
                userAccessInvalidationService,
                auditEventService);
    }

    private static SocialProviderSettingsService.ProviderCredentials advancedProvider(
            String registrationId,
            boolean shortStateParameter,
            boolean caseSensitiveUsername,
            boolean mfaRequired,
            boolean requiredClaimsNull) {
        return new SocialProviderSettingsService.ProviderCredentials(
                registrationId,
                registrationId,
                registrationId,
                registrationId,
                "client-id",
                "client-secret",
                true,
                false,
                false,
                false,
                mfaRequired,
                requiredClaimsNull ? null : "sub",
                false,
                false,
                0,
                "always",
                null,
                null,
                null,
                null,
                null,
                "client_secret_basic",
                "openid,profile,email",
                "sub",
                registrationId,
                shortStateParameter,
                caseSensitiveUsername);
    }

    private static OAuth2AuthenticationToken authentication() {
        return authentication(
                "google",
                Map.of(
                        "sub",
                        "google-subject",
                        "email",
                        "ada@example.test",
                        "email_verified",
                        true,
                        "given_name",
                        "Ada",
                        "family_name",
                        "Lovelace",
                        "picture",
                        "https://images.example.test/ada.jpg"));
    }

    private static OAuth2AuthenticationToken authentication(String registrationId, String subject) {
        return authentication(registrationId, Map.of("sub", subject));
    }

    private static OAuth2AuthenticationToken authentication(
            String registrationId, Map<String, Object> attributes) {
        OAuth2User user =
                new DefaultOAuth2User(
                        java.util.Set.of(new SimpleGrantedAuthority("ROLE_OAUTH2_USER")),
                        attributes,
                        "sub");
        return new OAuth2AuthenticationToken(user, user.getAuthorities(), registrationId);
    }
}
