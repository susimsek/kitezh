package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.LocalizationMessageOverrideEntity;
import io.github.susimsek.kitezh.domain.LocalizationSettingsEntity;
import io.github.susimsek.kitezh.dto.admin.LocalizationMessageOverrideRequestDTO;
import io.github.susimsek.kitezh.dto.admin.LocalizationSettingsRequestDTO;
import io.github.susimsek.kitezh.repository.LocalizationMessageOverrideRepository;
import io.github.susimsek.kitezh.repository.LocalizationSettingsRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class LocalizationSettingsServiceTest {

    @Mock private LocalizationSettingsRepository settingsRepository;
    @Mock private LocalizationMessageOverrideRepository overrideRepository;
    @Mock private AdminAuditEventService auditEventService;

    @Test
    void rejectsDefaultLocaleThatIsNotEnabled() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .update(
                                                new LocalizationSettingsRequestDTO(
                                                        true, "tr", List.of("en"))))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void exposesConfiguredLocalesAndDefault() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(settings()));

        var result = service().get();

        assertThat(result.defaultLocale()).isEqualTo("en");
        assertThat(result.supportedLocales()).containsExactly("en", "tr");
        assertThat(result.availableLocales()).containsExactly("en", "tr");
        assertThat(result.availableBundles())
                .containsExactly("login", "account", "admin", "email", "backend", "common");
    }

    @Test
    void exposesLocalizationStateAndLocaleFallbacks() {
        LocalizationSettingsEntity settings = settings();
        settings.setSupportedLocales("en,, tr ");
        settings.setDefaultLocale(" ");
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(settings));

        assertThat(service().isInternationalizationEnabled()).isTrue();
        assertThat(service().supportedLocales()).containsExactly("en", "tr");
        assertThat(service().defaultLocale(Locale.forLanguageTag("tr")))
                .isEqualTo(Locale.forLanguageTag("tr"));
        assertThat(service().isSupported(null)).isFalse();
        assertThat(service().isSupported(Locale.ENGLISH)).isTrue();
        assertThat(service().isSupported(Locale.FRANCE)).isFalse();
        assertThat(service().defaultLocale(Locale.ENGLISH)).isEqualTo(Locale.ENGLISH);
    }

    @Test
    void exposesAvailableValuesAndRejectsUninitializedSettings() {
        assertThat(service().availableLocales()).containsExactly("en", "tr");
        assertThat(service().availableBundles())
                .containsExactly("login", "account", "admin", "email", "backend", "common");
        when(settingsRepository.findById(1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().get()).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void updatesSettingsWithNormalizedDistinctLocales() {
        LocalizationSettingsEntity settings = settings();
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(settings));

        var result =
                service()
                        .update(
                                new LocalizationSettingsRequestDTO(
                                        false, " TR ", List.of("en", "tr", "en")));

        assertThat(result.defaultLocale()).isEqualTo("tr");
        assertThat(result.supportedLocales()).containsExactly("en", "tr");
        assertThat(settings.isInternationalizationEnabled()).isFalse();
        assertThat(settings.getSupportedLocales()).isEqualTo("en,tr");
        verify(settingsRepository).save(settings);
        verify(auditEventService)
                .record("localization.settings.updated", "localization", "default");
    }

    @Test
    void rejectsUnsupportedLocalesAndBundles() {
        when(overrideRepository.findAll(
                        org.mockito.ArgumentMatchers
                                .<org.springframework.data.jpa.domain.Specification<
                                                LocalizationMessageOverrideEntity>>
                                        any(),
                        any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<LocalizationMessageOverrideEntity>(List.of()));

        assertThatThrownBy(
                        () ->
                                service()
                                        .update(
                                                new LocalizationSettingsRequestDTO(
                                                        true, "en", List.of("fr"))))
                .isInstanceOf(ApiException.class);
        assertThat(service().overrides(null, "fr", null, PageRequest.of(0, 20))).isEmpty();
        assertThatThrownBy(() -> service().publicOverrides("en", "unsupported"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void validatesOverrideSearchAndReturnsEmptyForUnsupportedPublicLocale() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .overrides(
                                                "x".repeat(101), null, null, PageRequest.of(0, 20)))
                .isInstanceOf(ApiException.class);
        assertThat(service().publicOverrides("fr", null)).isEmpty();
        assertThat(service().bundledMessages("fr", "admin")).isEmpty();
    }

    @Test
    void appliesQueryLocaleAndBundleFiltersToOverrideSpecification() {
        when(overrideRepository.findAll(
                        org.mockito.ArgumentMatchers
                                .<Specification<LocalizationMessageOverrideEntity>>any(),
                        org.mockito.ArgumentMatchers
                                .<org.springframework.data.domain.Pageable>any()))
                .thenReturn(new PageImpl<LocalizationMessageOverrideEntity>(List.of()));

        service().overrides(" Login ", " TR ", " ADMIN ", PageRequest.of(0, 20));

        ArgumentCaptor<Specification<LocalizationMessageOverrideEntity>> captor =
                ArgumentCaptor.forClass(Specification.class);
        verify(overrideRepository).findAll(captor.capture(), any(Pageable.class));

        CriteriaBuilder criteriaBuilder = mock(CriteriaBuilder.class);
        CriteriaQuery<LocalizationMessageOverrideEntity> query = mock(CriteriaQuery.class);
        Root root = mock(Root.class);
        Path path = mock(Path.class);
        Expression<String> lowered = mock(Expression.class);
        Predicate predicate = mock(Predicate.class);
        when(criteriaBuilder.conjunction()).thenReturn(predicate);
        when(root.get(anyString())).thenReturn(path);
        when(criteriaBuilder.lower(any())).thenReturn(lowered);
        when(criteriaBuilder.like(eq(lowered), anyString())).thenReturn(predicate);
        when(criteriaBuilder.or(any(Predicate.class), any(Predicate.class))).thenReturn(predicate);
        when(criteriaBuilder.and(any(Predicate.class), any(Predicate.class))).thenReturn(predicate);
        when(criteriaBuilder.equal(any(), anyString())).thenReturn(predicate);

        assertThat(captor.getValue().toPredicate(root, query, criteriaBuilder)).isSameAs(predicate);
        verify(criteriaBuilder, times(2)).like(lowered, "%login%");
        verify(criteriaBuilder).equal(path, "tr");
        verify(criteriaBuilder).equal(path, "admin");
    }

    @Test
    void createsUpdatesAndDeletesMessageOverrides() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(settings()));
        LocalizationMessageOverrideEntity saved = new LocalizationMessageOverrideEntity();
        saved.setId(7L);
        when(overrideRepository.save(any(LocalizationMessageOverrideEntity.class)))
                .thenAnswer(
                        invocation -> {
                            LocalizationMessageOverrideEntity entity = invocation.getArgument(0);
                            entity.setId(saved.getId());
                            return entity;
                        });

        var created =
                service()
                        .create(
                                new LocalizationMessageOverrideRequestDTO(
                                        " EN ", " ADMIN ", " login.title ", " Welcome "));

        assertThat(created.id()).isEqualTo(7L);
        assertThat(created.locale()).isEqualTo("en");
        assertThat(created.bundle()).isEqualTo("admin");
        assertThat(created.messageKey()).isEqualTo("login.title");
        assertThat(created.messageValue()).isEqualTo("Welcome");
        verify(auditEventService)
                .record("localization.message.override.created", "localization-message", "7");

        LocalizationMessageOverrideEntity existing = override("tr", "admin", "home.title");
        existing.setId(8L);
        when(overrideRepository.findById(8L)).thenReturn(Optional.of(existing));
        var updated =
                service()
                        .updateMessageOverride(
                                8L,
                                new LocalizationMessageOverrideRequestDTO(
                                        "tr", "admin", "home.title", " Ana sayfa "));
        assertThat(updated.messageValue()).isEqualTo("Ana sayfa");
        verify(auditEventService)
                .record("localization.message.override.updated", "localization-message", "8");

        service().delete(8L);
        verify(overrideRepository).delete(existing);
        verify(auditEventService)
                .record("localization.message.override.deleted", "localization-message", "8");
    }

    @Test
    void rejectsDuplicateOrMissingMessageOverrides() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(settings()));
        LocalizationMessageOverrideRequestDTO request =
                new LocalizationMessageOverrideRequestDTO("en", "admin", "home.title", "Home");
        when(overrideRepository.existsByLocaleAndBundleAndMessageKey("en", "admin", "home.title"))
                .thenReturn(true);
        assertThatThrownBy(() -> service().create(request)).isInstanceOf(ApiException.class);

        when(overrideRepository.findById(9L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().updateMessageOverride(9L, request))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service().delete(9L)).isInstanceOf(ApiException.class);

        LocalizationMessageOverrideEntity existing = override("en", "admin", "home.title");
        existing.setId(10L);
        when(overrideRepository.findById(10L)).thenReturn(Optional.of(existing));
        when(overrideRepository.existsByLocaleAndBundleAndMessageKeyAndIdNot(
                        "en", "admin", "home.title", 10L))
                .thenReturn(true);
        assertThatThrownBy(() -> service().updateMessageOverride(10L, request))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsOverridesForDisabledLocale() {
        LocalizationSettingsEntity settings = settings();
        settings.setSupportedLocales("en");
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(settings));
        LocalizationMessageOverrideRequestDTO request =
                new LocalizationMessageOverrideRequestDTO("tr", "admin", "key", "value");
        assertThatThrownBy(() -> service().create(request)).isInstanceOf(ApiException.class);
    }

    @Test
    void returnsOverridesForSelectedBundle() {
        LocalizationMessageOverrideEntity override = new LocalizationMessageOverrideEntity();
        override.setLocale("tr");
        override.setBundle("backend");
        override.setMessageKey("login.title");
        override.setMessageValue("Oturum aç");
        when(overrideRepository.findByLocaleAndBundle(
                        "tr",
                        "backend",
                        PageRequest.of(
                                0,
                                1000,
                                org.springframework.data.domain.Sort.by(
                                        org.springframework.data.domain.Sort.Direction.ASC,
                                        "messageKey"))))
                .thenReturn(new PageImpl<>(List.of(override)));

        var result = service().publicOverrides("tr", "backend");

        assertThat(result).containsEntry("login.title", "Oturum aç");
    }

    @Test
    void exposesBundledBackendMessagesForEffectiveMessageSearch() {
        var result = service().bundledMessages("en", "backend");

        assertThat(result)
                .containsEntry("app.security.unauthorized", "Authentication is required.")
                .doesNotContainKey("mail.test.subject");
    }

    @Test
    void exposesBundledEmailMessagesForEffectiveMessageSearch() {
        var result = service().bundledMessages("en", "email");

        assertThat(result)
                .containsEntry("mail.test.subject", "SMTP connection test")
                .doesNotContainKey("app.security.unauthorized");
    }

    private LocalizationSettingsService service() {
        return new LocalizationSettingsService(
                settingsRepository, overrideRepository, auditEventService);
    }

    private static LocalizationSettingsEntity settings() {
        LocalizationSettingsEntity settings = new LocalizationSettingsEntity();
        settings.setId(1L);
        settings.setInternationalizationEnabled(true);
        settings.setDefaultLocale("en");
        settings.setSupportedLocales("en,tr");
        return settings;
    }

    private static LocalizationMessageOverrideEntity override(
            String locale, String bundle, String key) {
        LocalizationMessageOverrideEntity entity = new LocalizationMessageOverrideEntity();
        entity.setLocale(locale);
        entity.setBundle(bundle);
        entity.setMessageKey(key);
        entity.setMessageValue("value");
        return entity;
    }
}
