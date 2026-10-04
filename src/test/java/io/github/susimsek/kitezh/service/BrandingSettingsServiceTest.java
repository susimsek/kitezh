package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.BrandingSettingsEntity;
import io.github.susimsek.kitezh.dto.admin.AdminBrandingSettingsRequestDTO;
import io.github.susimsek.kitezh.repository.BrandingSettingsRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class BrandingSettingsServiceTest {

    private final BrandingSettingsRepository repository = mock(BrandingSettingsRepository.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final BrandingSettingsService service =
            new BrandingSettingsService(repository, auditEventService);

    @Test
    void returnsPublicSettingsWithoutAdministrativeDetails() {
        when(repository.findById(1L)).thenReturn(Optional.of(settings()));

        assertThat(service.publicSettings())
                .satisfies(
                        value -> {
                            assertThat(value.applicationName()).isEqualTo("Kitezh");
                            assertThat(value.logoPath()).isEqualTo("/brand/logo.svg");
                            assertThat(value.primaryColor()).isEqualTo("#0d6efd");
                        });
    }

    @Test
    void updatesColorsAndApplicationNameAndAuditsTheChange() {
        BrandingSettingsEntity entity = settings();
        when(repository.findById(1L)).thenReturn(Optional.of(entity));
        when(repository.save(any(BrandingSettingsEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result =
                service.update(
                        new AdminBrandingSettingsRequestDTO(
                                "  Demo Console  ", "#ABCDEF", "#123456", "#FEDCBA"));

        assertThat(result.applicationName()).isEqualTo("Demo Console");
        assertThat(result.primaryColor()).isEqualTo("#abcdef");
        assertThat(result.accentColor()).isEqualTo("#123456");
        assertThat(result.backgroundColor()).isEqualTo("#fedcba");
        verify(repository).save(entity);
        verify(auditEventService).record("branding.settings.updated", "branding", "default");
    }

    private static BrandingSettingsEntity settings() {
        BrandingSettingsEntity entity = new BrandingSettingsEntity();
        entity.setId(1L);
        entity.setApplicationName("Kitezh");
        entity.setLogoPath("/brand/logo.svg");
        entity.setFaviconPath("/favicon.ico");
        entity.setAppleTouchIconPath("/apple-icon.png");
        entity.setPrimaryColor("#0d6efd");
        entity.setAccentColor("#0b2b69");
        entity.setBackgroundColor("#f8f9fa");
        return entity;
    }
}
