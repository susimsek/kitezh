package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.SamlProviderConfigEntity;
import io.github.susimsek.kitezh.domain.SocialIdentityEntity;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.SamlProviderConfigRepository;
import io.github.susimsek.kitezh.repository.SocialIdentityRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.UserAccessInvalidationService;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.saml2.provider.service.authentication.Saml2AuthenticatedPrincipal;
import org.springframework.security.saml2.provider.service.authentication.Saml2Authentication;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class SamlLoginServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private SocialIdentityRepository socialIdentityRepository;
    @Mock private SocialProviderRepository providerRepository;
    @Mock private SamlProviderConfigRepository configRepository;
    @Mock private AuthorityRepository authorityRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private SocialProviderSettingsService providerSettingsService;
    @Mock private SocialIdentityMapperService mapperService;
    @Mock private ObjectMapper objectMapper;
    @Mock private AdminAuditEventService auditEventService;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;

    private final SocialProviderEntity provider = provider();
    private final SamlProviderConfigEntity config = new SamlProviderConfigEntity();

    @BeforeEach
    void configureProvider() {
        config.setProviderId(provider.getId());
        lenient()
                .when(providerRepository.findByAliasIgnoreCase("saml-e2e"))
                .thenReturn(Optional.of(provider));
        lenient()
                .when(configRepository.findByProviderId(provider.getId()))
                .thenReturn(Optional.of(config));
    }

    @Test
    void rejectsMissingConfiguredPrincipalInsteadOfFallingBackToTransientNameId() {
        config.setPrincipalAttribute("uid");
        SamlLoginService samlService = service();
        Saml2Authentication samlAuthentication = authentication();

        assertThatThrownBy(() -> samlService.findOrCreate("saml-e2e", samlAuthentication))
                .isInstanceOf(AuthenticationServiceException.class)
                .hasMessageContaining("subject");
        verify(userRepository, never()).save(any());
        verify(socialIdentityRepository, never())
                .findByProviderAndSubject(anyString(), anyString());
    }

    @Test
    void createsLocalUserWithStableSamlIdentityAndDefaultRole() {
        stubProviderSettings();
        stubMapper();
        AuthorityEntity userRole = new AuthorityEntity(2L, AuthoritiesConstants.USER);
        when(socialIdentityRepository.findByProviderAndSubject("saml-e2e", "subject-1"))
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

        String username = service().findOrCreate("saml-e2e", authentication());

        assertThat(username).startsWith("saml_saml-e2e_");
        verify(socialIdentityRepository).save(any(SocialIdentityEntity.class));
        verify(auditEventService)
                .record("saml.login.created", "saml_identity", "saml-e2e:subject-1");
    }

    @Test
    void rejectsVerifiedSamlEmailWhenItBelongsToAnExistingLocalAccount() {
        when(socialIdentityRepository.findByProviderAndSubject("saml-e2e", "subject-1"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("ada@example.test"))
                .thenReturn(Optional.of(new UserEntity()));

        final SamlLoginService samlService = service();
        final Saml2Authentication samlAuthentication = authentication();
        assertThatThrownBy(() -> samlService.findOrCreate("saml-e2e", samlAuthentication))
                .isInstanceOf(SocialAccountLinkRequiredException.class)
                .satisfies(
                        exception ->
                                assertThat(
                                                ((SocialAccountLinkRequiredException) exception)
                                                        .pendingLink())
                                        .containsEntry("provider", "saml-e2e")
                                        .containsEntry("subject", "subject-1"));
    }

    @Test
    void reusesExistingSubjectWithoutCreatingAnotherLocalUser() {
        stubProviderSettings();
        stubMapper();
        UserEntity user = new UserEntity();
        user.setUsername("saml_saml-e2e_existing");
        SocialIdentityEntity identity = new SocialIdentityEntity("saml-e2e", "subject-1", user);
        when(socialIdentityRepository.findByProviderAndSubject("saml-e2e", "subject-1"))
                .thenReturn(Optional.of(identity));

        assertThat(service().findOrCreate("saml-e2e", authentication()))
                .isEqualTo("saml_saml-e2e_existing");
    }

    @Test
    void linksVerifiedSamlSubjectToAnAuthenticatedLocalUser() {
        stubProviderSettings();
        stubMapper();
        UserEntity user = new UserEntity();
        user.setUsername("ada");
        when(userRepository.findForLoginUpdate("ada")).thenReturn(Optional.of(user));
        when(socialIdentityRepository.findByProviderAndSubject("saml-e2e", "subject-1"))
                .thenReturn(Optional.empty());
        when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "saml-e2e"))
                .thenReturn(List.of());
        when(socialIdentityRepository.save(any(SocialIdentityEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service().linkExisting("ada", "saml-e2e", authentication());

        verify(socialIdentityRepository, times(2)).save(any(SocialIdentityEntity.class));
        verify(auditEventService)
                .record("account.saml_link.created", "saml_identity", "ada:saml-e2e");
    }

    @Test
    void updatesExistingProfileAndPersistsMappedClaimsWhenSyncIsEnabled() throws Exception {
        stubProviderSettings();
        provider.setSyncMode("force");
        UserEntity user = new UserEntity();
        user.setUsername("saml_saml-e2e_existing");
        SocialIdentityEntity identity = new SocialIdentityEntity("saml-e2e", "subject-1", user);
        when(socialIdentityRepository.findByProviderAndSubject("saml-e2e", "subject-1"))
                .thenReturn(Optional.of(identity));
        when(mapperService.apply(
                        anyString(),
                        any(),
                        any(UserEntity.class),
                        anyBoolean(),
                        anyBoolean(),
                        anyString(),
                        any(SocialIdentityEntity.class)))
                .thenReturn(Map.of("groups", Map.of("value", "engineering")));
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"groups\":{}}");

        assertThat(service().findOrCreate("saml-e2e", authentication()))
                .isEqualTo("saml_saml-e2e_existing");
        assertThat(user.getFirstName()).isEqualTo("Ada");
        assertThat(user.getLastName()).isEqualTo("Lovelace");
        assertThat(user.getEmail()).isEqualTo("ada@example.test");
        assertThat(identity.getMappedClaims()).isEqualTo("{\"groups\":{}}");
    }

    @Test
    void exposesProviderMfaRequirementAndReturnsFalseForUnknownProvider() {
        provider.setMfaRequired(true);
        assertThat(service().providerRequiresMfa("saml-e2e")).isTrue();

        when(providerRepository.findByAliasIgnoreCase("missing")).thenReturn(Optional.empty());
        when(providerRepository.findByRegistrationId("missing")).thenReturn(Optional.empty());
        assertThat(service().providerRequiresMfa("missing")).isFalse();
    }

    @Test
    void rejectsMissingRequiredSamlClaimsBeforeCreatingAUser() {
        provider.setRequiredClaims("sub,department");

        final SamlLoginService samlService = service();
        final Saml2Authentication samlAuthentication = authentication();
        assertThatThrownBy(() -> samlService.findOrCreate("saml-e2e", samlAuthentication))
                .isInstanceOf(AuthenticationServiceException.class)
                .hasMessageContaining("department");
    }

    @Test
    void rejectsDisabledAndAccountLinkingOnlyProviders() {
        provider.setEnabled(false);
        final SamlLoginService samlService = service();
        final Saml2Authentication samlAuthentication = authentication();
        assertThatThrownBy(() -> samlService.findOrCreate("saml-e2e", samlAuthentication))
                .isInstanceOf(AuthenticationServiceException.class);

        provider.setEnabled(true);
        provider.setAccountLinkingOnly(true);
        assertThatThrownBy(() -> samlService.findOrCreate("saml-e2e", samlAuthentication))
                .isInstanceOf(AuthenticationServiceException.class)
                .hasMessageContaining("account linking");
    }

    @Test
    void rejectsConflictingSamlLinks() {
        UserEntity user = new UserEntity();
        user.setUsername("ada");
        UserEntity otherUser = new UserEntity();
        otherUser.setId(99L);
        SocialIdentityEntity identity =
                new SocialIdentityEntity("saml-e2e", "subject-1", otherUser);
        when(userRepository.findForLoginUpdate("ada")).thenReturn(Optional.of(user));
        when(socialIdentityRepository.findByProviderAndSubject("saml-e2e", "subject-1"))
                .thenReturn(Optional.of(identity));

        final SamlLoginService samlService = service();
        final Saml2Authentication samlAuthentication = authentication();
        assertThatThrownBy(() -> samlService.linkExisting("ada", "saml-e2e", samlAuthentication))
                .isInstanceOf(AuthenticationServiceException.class)
                .hasMessageContaining("already linked");
    }

    @Test
    void rejectsSecondSamlIdentityForTheSameProvider() {
        UserEntity user = new UserEntity();
        user.setUsername("ada");
        when(userRepository.findForLoginUpdate("ada")).thenReturn(Optional.of(user));
        when(socialIdentityRepository.findByProviderAndSubject("saml-e2e", "subject-1"))
                .thenReturn(Optional.empty());
        when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "saml-e2e"))
                .thenReturn(List.of(new SocialIdentityEntity("saml-e2e", "other", user)));

        final SamlLoginService samlService = service();
        final Saml2Authentication samlAuthentication = authentication();
        assertThatThrownBy(() -> samlService.linkExisting("ada", "saml-e2e", samlAuthentication))
                .isInstanceOf(AuthenticationServiceException.class)
                .hasMessageContaining("different SAML account");
    }

    @Test
    void rejectsMissingSamlConfigurationAndUnknownLocalAccount() {
        when(configRepository.findByProviderId(provider.getId())).thenReturn(Optional.empty());
        final SamlLoginService samlService = service();
        final Saml2Authentication samlAuthentication = authentication();
        assertThatThrownBy(() -> samlService.findOrCreate("saml-e2e", samlAuthentication))
                .isInstanceOf(AuthenticationServiceException.class)
                .hasMessageContaining("configuration");

        when(configRepository.findByProviderId(provider.getId())).thenReturn(Optional.of(config));
        when(userRepository.findForLoginUpdate("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(
                        () -> samlService.linkExisting("missing", "saml-e2e", samlAuthentication))
                .isInstanceOf(AuthenticationServiceException.class)
                .hasMessageContaining("local account");
    }

    @Test
    void normalizesSamlAttributesAndRejectsMissingSubjects() throws Exception {
        assertThat(invoke("normalizeEmail", new Class<?>[] {String.class}, "ADA@EXAMPLE.TEST"))
                .isEqualTo("ada@example.test");
        assertThat(invoke("normalizeEmail", new Class<?>[] {String.class}, " ")).isNull();
        assertThat(invoke("first", new Class<?>[] {List.class}, List.of(" subject ")))
                .isEqualTo("subject");
        assertThat(
                        invoke(
                                "value",
                                new Class<?>[] {Map.class, String.class},
                                Map.of("claim", List.of(" value ")),
                                "claim"))
                .isEqualTo("value");
        assertThat(
                        invoke(
                                "username",
                                new Class<?>[] {String.class, String.class},
                                "saml-e2e",
                                "subject-1"))
                .asString()
                .startsWith("saml_saml-e2e_");
        assertThatThrownBy(
                        () ->
                                invoke(
                                        "required",
                                        new Class<?>[] {Map.class, String.class},
                                        Map.of(),
                                        "sub"))
                .isInstanceOf(InvocationTargetException.class)
                .hasCauseInstanceOf(AuthenticationServiceException.class);
        assertThatThrownBy(
                        () ->
                                invoke(
                                        "ensureRequiredClaims",
                                        new Class<?>[] {Map.class, String.class},
                                        Map.of("sub", "subject"),
                                        "sub,email"))
                .isInstanceOf(InvocationTargetException.class)
                .hasCauseInstanceOf(AuthenticationServiceException.class);
    }

    @Test
    void reportsMappedClaimSerializationFailures() throws Exception {
        stubProviderSettings();
        UserEntity user = new UserEntity();
        user.setUsername("saml_saml-e2e_existing");
        SocialIdentityEntity identity = new SocialIdentityEntity("saml-e2e", "subject-1", user);
        when(socialIdentityRepository.findByProviderAndSubject("saml-e2e", "subject-1"))
                .thenReturn(Optional.of(identity));
        when(mapperService.apply(
                        anyString(),
                        any(),
                        any(UserEntity.class),
                        anyBoolean(),
                        anyBoolean(),
                        anyString(),
                        any(SocialIdentityEntity.class)))
                .thenReturn(Map.of("department", Map.of("value", "engineering")));
        when(objectMapper.writeValueAsString(any()))
                .thenThrow(new JacksonException("serialization failed") {});

        final SamlLoginService samlService = service();
        final Saml2Authentication samlAuthentication = authentication();
        assertThatThrownBy(() -> samlService.findOrCreate("saml-e2e", samlAuthentication))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("claims");
    }

    private static Object invoke(String name, Class<?>[] parameterTypes, Object... arguments)
            throws Exception {
        Method method = SamlLoginService.class.getDeclaredMethod(name, parameterTypes);
        method.setAccessible(true);
        return method.invoke(null, arguments);
    }

    private SamlLoginService service() {
        return new SamlLoginService(
                userRepository,
                socialIdentityRepository,
                providerRepository,
                configRepository,
                authorityRepository,
                passwordEncoder,
                providerSettingsService,
                mapperService,
                objectMapper,
                auditEventService,
                userAccessInvalidationService);
    }

    private Saml2Authentication authentication() {
        Saml2AuthenticatedPrincipal principal = mock(Saml2AuthenticatedPrincipal.class);
        lenient().when(principal.getName()).thenReturn("subject-1");
        lenient()
                .when(principal.getAttributes())
                .thenReturn(
                        Map.of(
                                "email", List.of((Object) "ada@example.test"),
                                "givenName", List.of((Object) "Ada"),
                                "sn", List.of((Object) "Lovelace")));
        lenient().when(principal.getAttribute("email")).thenReturn(List.of("ada@example.test"));
        lenient().when(principal.getAttribute("givenName")).thenReturn(List.of("Ada"));
        lenient().when(principal.getAttribute("sn")).thenReturn(List.of("Lovelace"));
        return new Saml2Authentication(
                principal, "saml-response", List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private void stubProviderSettings() {
        when(providerSettingsService.provider("saml-e2e"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "saml-e2e",
                                "saml-e2e",
                                "SAML E2E",
                                "saml",
                                null,
                                null,
                                true,
                                false,
                                false,
                                true,
                                false,
                                "sub,email",
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
                                "generic"));
    }

    private void stubMapper() {
        when(mapperService.apply(
                        anyString(),
                        any(),
                        any(UserEntity.class),
                        anyBoolean(),
                        anyBoolean(),
                        anyString(),
                        any(SocialIdentityEntity.class)))
                .thenReturn(Map.of());
    }

    private static SocialProviderEntity provider() {
        SocialProviderEntity provider = new SocialProviderEntity();
        provider.setAlias("saml-e2e");
        provider.setRegistrationId("saml-e2e");
        provider.setProviderType("saml");
        provider.setEnabled(true);
        provider.setRequiredClaims("sub,email");
        provider.setSyncMode("import");
        provider.setTrustEmail(true);
        return provider;
    }
}
