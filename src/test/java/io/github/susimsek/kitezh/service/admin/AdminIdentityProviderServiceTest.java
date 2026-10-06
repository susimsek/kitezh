package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.security.SamlRelyingPartyRegistrationRepository;
import io.github.susimsek.kitezh.config.security.SocialLoginSecretCipher;
import io.github.susimsek.kitezh.domain.SamlProviderConfigEntity;
import io.github.susimsek.kitezh.domain.SocialIdentityEntity;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.domain.SocialProviderMapperEntity;
import io.github.susimsek.kitezh.dto.admin.AdminIdentityProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminIdentityProviderRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminProviderMapperRequestDTO;
import io.github.susimsek.kitezh.repository.SamlProviderConfigRepository;
import io.github.susimsek.kitezh.repository.SocialIdentityRepository;
import io.github.susimsek.kitezh.repository.SocialProviderMapperRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService;
import io.github.susimsek.kitezh.service.error.ApiException;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionSynchronizationUtils;

@SuppressWarnings("java:S5778")
class AdminIdentityProviderServiceTest {

    private final SocialProviderRepository providerRepository =
            mock(SocialProviderRepository.class);
    private final SocialProviderMapperRepository mapperRepository =
            mock(SocialProviderMapperRepository.class);
    private final SocialIdentityRepository identityRepository =
            mock(SocialIdentityRepository.class);
    private final SocialLoginSecretCipher secretCipher = mock(SocialLoginSecretCipher.class);
    private final SamlProviderConfigRepository samlConfigRepository =
            mock(SamlProviderConfigRepository.class);
    private final SamlRelyingPartyRegistrationRepository samlRegistrationRepository =
            mock(SamlRelyingPartyRegistrationRepository.class);
    private final SocialProviderSettingsService settingsService =
            mock(SocialProviderSettingsService.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final AdminIdentityProviderService service =
            new AdminIdentityProviderService(
                    providerRepository,
                    mapperRepository,
                    identityRepository,
                    secretCipher,
                    settingsService,
                    auditEventService);

    private final AdminIdentityProviderService samlService =
            new AdminIdentityProviderService(
                    providerRepository,
                    samlConfigRepository,
                    mapperRepository,
                    identityRepository,
                    secretCipher,
                    settingsService,
                    samlRegistrationRepository,
                    auditEventService);

    @BeforeEach
    void setUp() {
        when(secretCipher.encrypt("secret")).thenReturn("encrypted");
        when(mapperRepository.countByProviderAlias(anyString())).thenReturn(2L);
        when(mapperRepository.findAll()).thenReturn(List.of());
    }

    @Test
    void findsProvidersWithMapperCountsAndDetails() {
        SocialProviderEntity provider = provider();
        SocialProviderMapperRepository.MapperCount count = mock();
        when(count.getAlias()).thenReturn("acme");
        when(count.getCount()).thenReturn(3L);
        when(providerRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(provider)));
        when(mapperRepository.countByProviderAliases(List.of("acme"))).thenReturn(List.of(count));
        when(providerRepository.findById("provider-1")).thenReturn(Optional.of(provider));

        assertThat(service.findAll(" ACME ", PageRequest.of(0, 20))).hasSize(1);
        @SuppressWarnings("unchecked")
        var captor = org.mockito.ArgumentCaptor.forClass(Specification.class);
        verify(providerRepository, org.mockito.Mockito.atLeastOnce())
                .findAll(captor.capture(), any(Pageable.class));
        Root<SocialProviderEntity> root = mock();
        CriteriaQuery<?> criteriaQuery = mock();
        CriteriaBuilder criteriaBuilder = mock();
        Predicate predicate = mock();
        Path<String> path = mock();
        when(root.get(anyString())).thenReturn((Path) path);
        when(criteriaBuilder.lower(org.mockito.ArgumentMatchers.<Expression<String>>any()))
                .thenReturn(path);
        when(criteriaBuilder.like(
                        org.mockito.ArgumentMatchers.<Expression<String>>any(), anyString()))
                .thenReturn(predicate);
        when(criteriaBuilder.or(org.mockito.ArgumentMatchers.<Predicate[]>any()))
                .thenReturn(predicate);
        captor.getAllValues().getFirst().toPredicate(root, criteriaQuery, criteriaBuilder);
        assertThat(service.findAll(null, PageRequest.of(0, 20))).hasSize(1);
        assertThat(service.findById("provider-1").alias()).isEqualTo("acme");
        when(providerRepository.findById("missing")).thenReturn(Optional.empty());
        assertThat(service.findById("missing")).isNull();
    }

    @Test
    void handlesEmptyProviderPagesAndMissingMutations() {
        when(providerRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        assertThat(service.findAll("", PageRequest.of(0, 20))).isEmpty();
        when(providerRepository.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.update("missing", request("Missing")))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.delete("missing")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.findMappers("missing", "", PageRequest.of(0, 20)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void createsAndUpdatesProviderAndMigratesMapperAliases() {
        when(providerRepository.existsByRegistrationId("acme")).thenReturn(false);
        when(providerRepository.existsByAliasIgnoreCase("acme")).thenReturn(false);
        when(providerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        AdminIdentityProviderRequestDTO request = request("Acme");

        var created = service.create(request);

        assertThat(created.registrationId()).isEqualTo("acme");
        assertThat(created.clientSecretConfigured()).isTrue();
        verify(settingsService).refreshClientRegistrations();
        verify(secretCipher).encrypt("secret");

        final SocialProviderEntity existing = provider();
        SocialProviderMapperEntity mapper = mapper("acme");
        when(providerRepository.findById("provider-1")).thenReturn(Optional.of(existing));
        when(providerRepository.findByRegistrationId("acme-new")).thenReturn(Optional.empty());
        when(providerRepository.findByAliasIgnoreCase("acme-new")).thenReturn(Optional.empty());
        when(mapperRepository.findAll()).thenReturn(List.of(mapper));

        var updated = service.update("provider-1", request("Acme New"));

        assertThat(updated.alias()).isEqualTo("acme");
        assertThat(existing.getDisplayName()).isEqualTo("Acme New");
        assertThat(mapper.getProviderAlias()).isEqualTo("acme");
        verify(auditEventService)
                .record(eq("identity-provider.created"), eq("identity-provider"), anyString());
    }

    @Test
    void deletesProviderAndMappersButRejectsLinkedIdentities() {
        SocialProviderEntity provider = provider();
        SocialProviderMapperEntity mapper = mapper("acme");
        when(providerRepository.findById("provider-1")).thenReturn(Optional.of(provider));
        when(identityRepository.findAllByProvider(anyString())).thenReturn(List.of());
        when(mapperRepository.findAll()).thenReturn(List.of(mapper));

        service.delete("provider-1");

        verify(mapperRepository).deleteAll(List.of(mapper));
        verify(providerRepository).delete(provider);

        when(identityRepository.findAllByProvider("acme"))
                .thenReturn(List.of(new SocialIdentityEntity()));
        assertThatThrownBy(() -> service.delete("provider-1"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("still linked");

        when(identityRepository.findAllByProvider("acme"))
                .thenReturn(List.of(new SocialIdentityEntity()));
        assertThatThrownBy(() -> service.delete("provider-1"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("still linked");
    }

    @Test
    void managesProviderMappersAndRejectsWrongProvider() {
        SocialProviderEntity provider = provider();
        when(providerRepository.findById("provider-1")).thenReturn(Optional.of(provider));
        when(mapperRepository.existsByProviderAliasAndNameIgnoreCase("acme", "email-mapper"))
                .thenReturn(false);
        when(mapperRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        AdminProviderMapperRequestDTO request = mapperRequest();

        var created = service.createMapper("provider-1", request);
        assertThat(created.name()).isEqualTo("email-mapper");

        SocialProviderMapperEntity mapper = mapper("acme");
        mapper.setId("mapper-1");
        mapper.setName("old");
        when(mapperRepository.findById("mapper-1")).thenReturn(Optional.of(mapper));
        when(mapperRepository.findAll()).thenReturn(List.of(mapper));
        var updated = service.updateMapper("provider-1", "mapper-1", request);
        assertThat(updated.name()).isEqualTo("email-mapper");
        service.deleteMapper("provider-1", "mapper-1");
        verify(mapperRepository).delete(mapper);

        mapper.setProviderAlias("other");
        assertThatThrownBy(() -> service.updateMapper("provider-1", "mapper-1", request))
                .isInstanceOf(ApiException.class);

        when(mapperRepository.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.updateMapper("provider-1", "missing", request))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.deleteMapper("provider-1", "missing"))
                .isInstanceOf(ApiException.class);

        mapper.setProviderAlias("other");
        assertThatThrownBy(() -> service.deleteMapper("provider-1", "mapper-1"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void coversMapperConflictsOptionalSearchAndProviderSecretFlags() {
        SocialProviderEntity provider = provider();
        when(providerRepository.findById("provider-1")).thenReturn(Optional.of(provider));
        when(mapperRepository
                        .findByProviderAliasAndNameContainingIgnoreCaseOrProviderAliasAndSourceClaimContainingIgnoreCase(
                                eq("acme"), eq(""), eq("acme"), eq(""), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));
        assertThat(service.findMappers("provider-1", null, PageRequest.of(0, 20))).isEmpty();

        SocialProviderMapperEntity current = mapper("acme");
        current.setId("mapper-1");
        current.setName("current");
        SocialProviderMapperEntity duplicate = mapper("acme");
        duplicate.setId("mapper-2");
        when(mapperRepository.findById("mapper-1")).thenReturn(Optional.of(current));
        when(mapperRepository.findAll()).thenReturn(List.of(current, duplicate));
        assertThatThrownBy(
                        () ->
                                service.updateMapper(
                                        "provider-1", "mapper-1", mapperRequest("email-mapper")))
                .isInstanceOf(ApiException.class);

        when(mapperRepository.existsByProviderAliasAndNameIgnoreCase("acme", "read-only"))
                .thenReturn(false);
        when(mapperRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        assertThat(service.createMapper("provider-1", mapperRequest("read-only")).syncMode())
                .isEqualTo("read_only");

        provider.setClientSecretEncrypted(" ");
        assertThat(service.findById("provider-1").clientSecretConfigured()).isFalse();
        provider.setClientId(null);
        provider.setClientSecretEncrypted("encrypted");
        assertThat(service.findById("provider-1"))
                .satisfies(
                        result -> {
                            assertThat(result.configured()).isFalse();
                            assertThat(result.clientSecretConfigured()).isTrue();
                        });
    }

    @Test
    void validatesProviderAndMapperConflicts() {
        when(providerRepository.existsByRegistrationId("acme")).thenReturn(true);
        assertThatThrownBy(() -> service.create(request("Acme")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already registered");

        when(providerRepository.existsByRegistrationId("acme")).thenReturn(false);
        when(providerRepository.existsByAliasIgnoreCase("acme")).thenReturn(true);
        assertThatThrownBy(() -> service.create(request("Acme"))).isInstanceOf(ApiException.class);

        when(providerRepository.existsByAliasIgnoreCase("acme")).thenReturn(false);
        AdminIdentityProviderRequestDTO baseRequest = request("Acme");
        AdminIdentityProviderRequestDTO invalidType =
                new AdminIdentityProviderRequestDTO(
                        baseRequest.registrationId(),
                        "invalid",
                        baseRequest.displayName(),
                        baseRequest.alias(),
                        baseRequest.iconKey(),
                        baseRequest.shortStateParameter(),
                        baseRequest.caseSensitiveUsername(),
                        baseRequest.enabled(),
                        baseRequest.clientId(),
                        baseRequest.clientSecret(),
                        baseRequest.hideOnLogin(),
                        baseRequest.accountLinkingOnly(),
                        baseRequest.trustEmail(),
                        baseRequest.mfaRequired(),
                        baseRequest.requiredClaims(),
                        baseRequest.storeTokens(),
                        baseRequest.storedTokensReadable(),
                        baseRequest.guiOrder(),
                        baseRequest.showInAccountConsole(),
                        baseRequest.syncMode(),
                        baseRequest.authorizationUri(),
                        baseRequest.tokenUri(),
                        baseRequest.userInfoUri(),
                        baseRequest.jwkSetUri(),
                        baseRequest.issuerUri(),
                        baseRequest.clientAuthenticationMethod(),
                        baseRequest.scopes(),
                        baseRequest.userNameAttribute());
        assertThatThrownBy(() -> service.create(invalidType)).isInstanceOf(ApiException.class);

        when(mapperRepository.existsByProviderAliasAndNameIgnoreCase("acme", "email-mapper"))
                .thenReturn(true);
        when(providerRepository.findById("provider-1")).thenReturn(Optional.of(provider()));
        assertThatThrownBy(() -> service.createMapper("provider-1", mapperRequest()))
                .isInstanceOf(ApiException.class);
        verify(providerRepository, never()).delete(any(SocialProviderEntity.class));
    }

    @Test
    void findsMappersAndMapsOptionalFields() {
        SocialProviderEntity provider = provider();
        SocialProviderMapperEntity mapper = mapper("acme");
        mapper.setId("mapper-1");
        when(providerRepository.findById("provider-1")).thenReturn(Optional.of(provider));
        when(mapperRepository
                        .findByProviderAliasAndNameContainingIgnoreCaseOrProviderAliasAndSourceClaimContainingIgnoreCase(
                                eq("acme"),
                                eq("email"),
                                eq("acme"),
                                eq("email"),
                                any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(mapper)));

        assertThat(service.findMappers("provider-1", " email ", PageRequest.of(0, 20)))
                .singleElement()
                .satisfies(result -> assertThat(result.id()).isEqualTo("mapper-1"));
    }

    @Test
    void rejectsUpdateConflictsAndAllowsKeepingExistingSecret() {
        final SocialProviderEntity existing = provider();
        SocialProviderEntity other = provider();
        other.setId("provider-2");
        other.setRegistrationId("other");
        other.setAlias("other");
        when(providerRepository.findById("provider-1")).thenReturn(Optional.of(existing));
        when(providerRepository.findByRegistrationId("acme")).thenReturn(Optional.of(other));
        assertThatThrownBy(() -> service.update("provider-1", request("Other")))
                .isInstanceOf(ApiException.class);

        when(providerRepository.findByRegistrationId("acme")).thenReturn(Optional.of(existing));
        when(providerRepository.findByAliasIgnoreCase("acme")).thenReturn(Optional.of(existing));
        when(providerRepository.findByAliasIgnoreCase("new-alias")).thenReturn(Optional.empty());
        AdminIdentityProviderRequestDTO changed = requestWithClientSecret(request("New"), null);
        when(providerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        service.update("provider-1", changed);
        assertThat(existing.getClientSecretEncrypted()).isEqualTo("encrypted");

        SocialProviderEntity aliasConflict = provider();
        aliasConflict.setId("provider-2");
        aliasConflict.setAlias("other");
        when(providerRepository.findByAliasIgnoreCase("other"))
                .thenReturn(Optional.of(aliasConflict));
        assertThatThrownBy(() -> service.update("provider-1", requestWithAlias("Other", "other")))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void changesProviderAliasAndMigratesExistingMappers() {
        SocialProviderEntity existing = provider();
        SocialProviderMapperEntity mapper = mapper("acme");
        when(providerRepository.findById("provider-1")).thenReturn(Optional.of(existing));
        when(providerRepository.findByRegistrationId("new-registration"))
                .thenReturn(Optional.empty());
        when(providerRepository.findByAliasIgnoreCase("new-alias")).thenReturn(Optional.empty());
        when(mapperRepository.findAll()).thenReturn(List.of(mapper));
        when(providerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.update("provider-1", requestWithAlias("New display", "new-alias"));

        assertThat(existing.getAlias()).isEqualTo("new-alias");
        assertThat(mapper.getProviderAlias()).isEqualTo("new-alias");
    }

    @Test
    void rejectsMissingOidcEndpointsAndBlankCreatedSecret() {
        AdminIdentityProviderRequestDTO base = request("Acme");
        AdminIdentityProviderRequestDTO missingEndpoints =
                new AdminIdentityProviderRequestDTO(
                        base.registrationId(),
                        "oidc",
                        base.displayName(),
                        base.alias(),
                        base.iconKey(),
                        base.shortStateParameter(),
                        base.caseSensitiveUsername(),
                        base.enabled(),
                        base.clientId(),
                        base.clientSecret(),
                        base.hideOnLogin(),
                        base.accountLinkingOnly(),
                        base.trustEmail(),
                        base.mfaRequired(),
                        base.requiredClaims(),
                        base.storeTokens(),
                        base.storedTokensReadable(),
                        base.guiOrder(),
                        base.showInAccountConsole(),
                        base.syncMode(),
                        " ",
                        null,
                        base.userInfoUri(),
                        base.jwkSetUri(),
                        base.issuerUri(),
                        base.clientAuthenticationMethod(),
                        base.scopes(),
                        base.userNameAttribute());
        assertThatThrownBy(() -> service.create(missingEndpoints)).isInstanceOf(ApiException.class);

        AdminIdentityProviderRequestDTO blankSecret =
                new AdminIdentityProviderRequestDTO(
                        base.registrationId(),
                        base.providerType(),
                        base.displayName(),
                        base.alias(),
                        base.iconKey(),
                        base.shortStateParameter(),
                        base.caseSensitiveUsername(),
                        base.enabled(),
                        base.clientId(),
                        " ",
                        base.hideOnLogin(),
                        base.accountLinkingOnly(),
                        base.trustEmail(),
                        base.mfaRequired(),
                        base.requiredClaims(),
                        base.storeTokens(),
                        base.storedTokensReadable(),
                        base.guiOrder(),
                        base.showInAccountConsole(),
                        base.syncMode(),
                        base.authorizationUri(),
                        base.tokenUri(),
                        base.userInfoUri(),
                        base.jwkSetUri(),
                        base.issuerUri(),
                        base.clientAuthenticationMethod(),
                        base.scopes(),
                        base.userNameAttribute());
        assertThatThrownBy(() -> service.create(blankSecret)).isInstanceOf(ApiException.class);

        assertThatThrownBy(() -> service.create(requestWithClientSecret(base, null)))
                .isInstanceOf(ApiException.class);

        AdminIdentityProviderRequestDTO missingToken =
                requestWithEndpoints(base, "https://acme.example/authorize", null);
        assertThatThrownBy(() -> service.create(missingToken)).isInstanceOf(ApiException.class);

        AdminIdentityProviderRequestDTO missingAuthorization =
                requestWithEndpoints(base, null, "https://acme.example/token");
        assertThatThrownBy(() -> service.create(missingAuthorization))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void createsNonOidcProviderWithDefaultsAndMapsIncompleteMetadata() {
        AdminIdentityProviderRequestDTO base = request("Google");
        AdminIdentityProviderRequestDTO google =
                new AdminIdentityProviderRequestDTO(
                        base.registrationId(),
                        "google",
                        base.displayName(),
                        base.alias(),
                        base.iconKey(),
                        base.shortStateParameter(),
                        base.caseSensitiveUsername(),
                        base.enabled(),
                        base.clientId(),
                        base.clientSecret(),
                        base.hideOnLogin(),
                        base.accountLinkingOnly(),
                        base.trustEmail(),
                        base.mfaRequired(),
                        " ",
                        base.storeTokens(),
                        base.storedTokensReadable(),
                        base.guiOrder(),
                        base.showInAccountConsole(),
                        "read-only",
                        null,
                        " ",
                        null,
                        null,
                        null,
                        base.clientAuthenticationMethod(),
                        base.scopes(),
                        base.userNameAttribute());
        when(providerRepository.existsByRegistrationId("acme")).thenReturn(false);
        when(providerRepository.existsByAliasIgnoreCase("acme")).thenReturn(false);
        when(providerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        AdminIdentityProviderDTO created = service.create(google);

        assertThat(created.providerType()).isEqualTo("google");
        assertThat(created.requiredClaims()).isEqualTo("sub");
        assertThat(created.tokenUri()).isNull();
        assertThat(created.syncMode()).isEqualTo("read_only");
    }

    @Test
    void createsManualSamlProviderAndPersistsApplicationWideConfiguration() {
        when(providerRepository.existsByRegistrationId("acme")).thenReturn(false);
        when(providerRepository.existsByAliasIgnoreCase("acme")).thenReturn(false);
        when(providerRepository.save(any()))
                .thenAnswer(
                        invocation -> {
                            SocialProviderEntity entity = invocation.getArgument(0);
                            entity.setId("provider-saml");
                            return entity;
                        });
        when(samlConfigRepository.findById("provider-saml")).thenReturn(Optional.empty());
        when(samlConfigRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        AdminIdentityProviderDTO result = samlService.create(samlRequest(null, false, null));

        assertThat(result.providerType()).isEqualTo("saml");
        verify(samlConfigRepository).save(any(SamlProviderConfigEntity.class));
        verify(samlRegistrationRepository).refresh();
    }

    @Test
    void refreshesSamlRegistrationsAfterTransactionCommit() {
        when(providerRepository.existsByRegistrationId("acme")).thenReturn(false);
        when(providerRepository.existsByAliasIgnoreCase("acme")).thenReturn(false);
        when(providerRepository.save(any()))
                .thenAnswer(
                        invocation -> {
                            SocialProviderEntity entity = invocation.getArgument(0);
                            entity.setId("provider-saml");
                            return entity;
                        });
        when(samlConfigRepository.findById("provider-saml")).thenReturn(Optional.empty());
        when(samlConfigRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        TransactionSynchronizationManager.initSynchronization();
        try {
            samlService.create(samlRequest(null, false, null));

            verify(samlRegistrationRepository, never()).refresh();
            TransactionSynchronizationUtils.triggerAfterCommit();
            verify(samlRegistrationRepository).refresh();
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void createsMetadataSamlProviderWithSigningAndDecryptionMaterial() {
        when(providerRepository.existsByRegistrationId("acme")).thenReturn(false);
        when(providerRepository.existsByAliasIgnoreCase("acme")).thenReturn(false);
        when(providerRepository.save(any()))
                .thenAnswer(
                        invocation -> {
                            SocialProviderEntity entity = invocation.getArgument(0);
                            entity.setId("provider-saml");
                            return entity;
                        });
        when(samlConfigRepository.findById("provider-saml")).thenReturn(Optional.empty());
        when(samlConfigRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(secretCipher.encrypt("signing-key")).thenReturn("encrypted-signing-key");
        when(secretCipher.encrypt("decryption-key")).thenReturn("encrypted-decryption-key");

        samlService.create(samlRequest("https://idp.example/metadata", true, "signing-key"));

        verify(secretCipher).encrypt("signing-key");
        verify(secretCipher).encrypt("decryption-key");
        verify(samlConfigRepository).save(any(SamlProviderConfigEntity.class));
    }

    @Test
    void rejectsSamlProviderWithoutMetadataOrManualPartyDetails() {
        when(providerRepository.existsByRegistrationId("acme")).thenReturn(false);
        when(providerRepository.existsByAliasIgnoreCase("acme")).thenReturn(false);

        assertThatThrownBy(() -> samlService.create(samlRequest("", false, null)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("SAML metadata");
    }

    @Test
    void reportsProviderWithoutConfiguredClientSecretAndRejectsInvalidIcon() {
        SocialProviderEntity provider = provider();
        provider.setClientId(" ");
        provider.setClientSecretEncrypted(null);
        when(providerRepository.findById("provider-1")).thenReturn(Optional.of(provider));

        AdminIdentityProviderDTO dto = service.findById("provider-1");

        assertThat(dto.clientSecretConfigured()).isFalse();

        AdminIdentityProviderRequestDTO base = request("Acme");
        AdminIdentityProviderRequestDTO invalidIcon =
                new AdminIdentityProviderRequestDTO(
                        base.registrationId(),
                        base.providerType(),
                        base.displayName(),
                        base.alias(),
                        "not-an-icon",
                        base.shortStateParameter(),
                        base.caseSensitiveUsername(),
                        base.enabled(),
                        base.clientId(),
                        base.clientSecret(),
                        base.hideOnLogin(),
                        base.accountLinkingOnly(),
                        base.trustEmail(),
                        base.mfaRequired(),
                        base.requiredClaims(),
                        base.storeTokens(),
                        base.storedTokensReadable(),
                        base.guiOrder(),
                        base.showInAccountConsole(),
                        base.syncMode(),
                        base.authorizationUri(),
                        base.tokenUri(),
                        base.userInfoUri(),
                        base.jwkSetUri(),
                        base.issuerUri(),
                        base.clientAuthenticationMethod(),
                        base.scopes(),
                        base.userNameAttribute());
        when(providerRepository.existsByRegistrationId("acme")).thenReturn(false);
        when(providerRepository.existsByAliasIgnoreCase("acme")).thenReturn(false);

        assertThatThrownBy(() -> service.create(invalidIcon)).isInstanceOf(ApiException.class);
    }

    private static SocialProviderEntity provider() {
        SocialProviderEntity provider = new SocialProviderEntity();
        provider.setId("provider-1");
        provider.setRegistrationId("acme");
        provider.setProviderType("oidc");
        provider.setDisplayName("Acme");
        provider.setAlias("acme");
        provider.setIconKey("generic");
        provider.setEnabled(true);
        provider.setClientId("client");
        provider.setClientSecretEncrypted("encrypted");
        provider.setAuthorizationUri("https://acme.example/authorize");
        provider.setTokenUri("https://acme.example/token");
        provider.setClientAuthenticationMethod("client_secret_basic");
        provider.setScopes("openid profile email");
        provider.setUserNameAttribute("sub");
        return provider;
    }

    private static SocialProviderMapperEntity mapper(String alias) {
        SocialProviderMapperEntity mapper = new SocialProviderMapperEntity();
        mapper.setProviderAlias(alias);
        mapper.setName("email-mapper");
        mapper.setSourceClaim("email");
        mapper.setTarget("email");
        mapper.setMapperType("user-attribute");
        mapper.setSyncMode("inherit");
        return mapper;
    }

    private static AdminIdentityProviderRequestDTO request(String displayName) {
        return new AdminIdentityProviderRequestDTO(
                "Acme",
                "OIDC",
                displayName,
                "Acme",
                "GENERIC",
                true,
                false,
                true,
                "client",
                "secret",
                false,
                false,
                true,
                false,
                "",
                true,
                true,
                4,
                "ALWAYS",
                "READ-ONLY",
                " https://acme.example/authorize ",
                " https://acme.example/token ",
                "https://acme.example/userinfo",
                "https://acme.example/jwks",
                "https://acme.example",
                " client_secret_basic ",
                "openid profile email",
                " sub ");
    }

    private static AdminIdentityProviderRequestDTO samlRequest(
            String metadataUri, boolean signAuthnRequests, String signingPrivateKey) {
        return new AdminIdentityProviderRequestDTO(
                "Acme",
                "saml",
                "Acme SAML",
                "Acme",
                "GENERIC",
                false,
                false,
                true,
                null,
                null,
                false,
                false,
                true,
                false,
                "sub,email",
                false,
                false,
                4,
                "ALWAYS",
                "IMPORT",
                null,
                null,
                null,
                null,
                null,
                "client_secret_basic",
                "openid",
                "sub",
                metadataUri,
                metadataUri == null ? "https://idp.example/entity" : null,
                metadataUri == null ? "https://idp.example/sso" : null,
                null,
                metadataUri == null ? "certificate" : null,
                signingPrivateKey,
                signAuthnRequests ? "signing-certificate" : null,
                "https://sp.example/entity",
                signAuthnRequests,
                true,
                null,
                "NameID",
                "email",
                "givenName",
                "sn",
                "groups",
                signAuthnRequests ? "decryption-key" : null,
                signAuthnRequests ? "decryption-certificate" : null,
                "https://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
                "REDIRECT",
                "POST",
                "REDIRECT",
                false,
                false);
    }

    private static AdminIdentityProviderRequestDTO requestWithAlias(
            String displayName, String alias) {
        AdminIdentityProviderRequestDTO base = request(displayName);
        return new AdminIdentityProviderRequestDTO(
                base.registrationId(),
                base.providerType(),
                base.displayName(),
                alias,
                base.iconKey(),
                base.shortStateParameter(),
                base.caseSensitiveUsername(),
                base.enabled(),
                base.clientId(),
                base.clientSecret(),
                base.hideOnLogin(),
                base.accountLinkingOnly(),
                base.trustEmail(),
                base.mfaRequired(),
                base.requiredClaims(),
                base.storeTokens(),
                base.storedTokensReadable(),
                base.guiOrder(),
                base.showInAccountConsole(),
                base.syncMode(),
                base.authorizationUri(),
                base.tokenUri(),
                base.userInfoUri(),
                base.jwkSetUri(),
                base.issuerUri(),
                base.clientAuthenticationMethod(),
                base.scopes(),
                base.userNameAttribute());
    }

    private static AdminIdentityProviderRequestDTO requestWithClientSecret(
            AdminIdentityProviderRequestDTO base, String clientSecret) {
        return new AdminIdentityProviderRequestDTO(
                base.registrationId(),
                base.providerType(),
                base.displayName(),
                base.alias(),
                base.iconKey(),
                base.shortStateParameter(),
                base.caseSensitiveUsername(),
                base.enabled(),
                base.clientId(),
                clientSecret,
                base.hideOnLogin(),
                base.accountLinkingOnly(),
                base.trustEmail(),
                base.mfaRequired(),
                base.requiredClaims(),
                base.storeTokens(),
                base.storedTokensReadable(),
                base.guiOrder(),
                base.showInAccountConsole(),
                base.syncMode(),
                base.authorizationUri(),
                base.tokenUri(),
                base.userInfoUri(),
                base.jwkSetUri(),
                base.issuerUri(),
                base.clientAuthenticationMethod(),
                base.scopes(),
                base.userNameAttribute());
    }

    private static AdminIdentityProviderRequestDTO requestWithEndpoints(
            AdminIdentityProviderRequestDTO base, String authorizationUri, String tokenUri) {
        return new AdminIdentityProviderRequestDTO(
                base.registrationId(),
                base.providerType(),
                base.displayName(),
                base.alias(),
                base.iconKey(),
                base.shortStateParameter(),
                base.caseSensitiveUsername(),
                base.enabled(),
                base.clientId(),
                base.clientSecret(),
                base.hideOnLogin(),
                base.accountLinkingOnly(),
                base.trustEmail(),
                base.mfaRequired(),
                base.requiredClaims(),
                base.storeTokens(),
                base.storedTokensReadable(),
                base.guiOrder(),
                base.showInAccountConsole(),
                base.syncMode(),
                authorizationUri,
                tokenUri,
                base.userInfoUri(),
                base.jwkSetUri(),
                base.issuerUri(),
                base.clientAuthenticationMethod(),
                base.scopes(),
                base.userNameAttribute());
    }

    private static AdminProviderMapperRequestDTO mapperRequest() {
        return mapperRequest("inherit");
    }

    private static AdminProviderMapperRequestDTO mapperRequest(String syncMode) {
        return new AdminProviderMapperRequestDTO(
                " email-mapper ", " email ", " email ", "user-attribute", syncMode, true, true);
    }
}
