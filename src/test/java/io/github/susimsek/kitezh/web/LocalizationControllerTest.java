package io.github.susimsek.kitezh.web;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.LocalizationSettingsDTO;
import io.github.susimsek.kitezh.dto.localization.UserLocaleDTO;
import io.github.susimsek.kitezh.dto.localization.UserLocaleRequestDTO;
import io.github.susimsek.kitezh.service.UserLocaleService;
import io.github.susimsek.kitezh.service.admin.LocalizationSettingsService;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class LocalizationControllerTest {

    @Mock private LocalizationSettingsService localizationSettingsService;
    @Mock private UserLocaleService userLocaleService;

    @Test
    void delegatesPublicLocalizationOperations() {
        LocalizationSettingsDTO settings = mock(LocalizationSettingsDTO.class);
        when(localizationSettingsService.get()).thenReturn(settings);
        when(localizationSettingsService.publicOverrides("tr", "admin"))
                .thenReturn(Map.of("login.title", "Giriş"));

        LocalizationController controller = controller();

        org.assertj.core.api.Assertions.assertThat(controller.get()).isSameAs(settings);
        org.assertj.core.api.Assertions.assertThat(controller.messages("tr", "admin"))
                .containsEntry("login.title", "Giriş");
        verify(localizationSettingsService).get();
        verify(localizationSettingsService).publicOverrides("tr", "admin");
    }

    @Test
    void delegatesAuthenticatedUserLocaleOperations() {
        var authentication = authenticated("alice");
        UserLocaleDTO current = new UserLocaleDTO("tr");
        when(userLocaleService.get("alice")).thenReturn(current);
        when(userLocaleService.update("alice", "tr")).thenReturn(current);

        LocalizationController controller = controller();

        org.assertj.core.api.Assertions.assertThat(controller.userLocale(authentication))
                .isSameAs(current);
        org.assertj.core.api.Assertions.assertThat(
                        controller.updateUserLocale(authentication, new UserLocaleRequestDTO("tr")))
                .isSameAs(current);
        verify(userLocaleService).get("alice");
        verify(userLocaleService).update("alice", "tr");
    }

    @Test
    void rejectsMissingOrAnonymousAuthentication() {
        LocalizationController controller = controller();
        AnonymousAuthenticationToken anonymous =
                new AnonymousAuthenticationToken(
                        "key",
                        "anonymous",
                        java.util.List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));

        assertThatThrownBy(() -> controller.userLocale(null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> controller.userLocale(anonymous)).isInstanceOf(ApiException.class);
        assertThatThrownBy(
                        () ->
                                controller.userLocale(
                                        UsernamePasswordAuthenticationToken.unauthenticated(
                                                "alice", "password")))
                .isInstanceOf(ApiException.class);
    }

    private LocalizationController controller() {
        return new LocalizationController(localizationSettingsService, userLocaleService);
    }

    private static UsernamePasswordAuthenticationToken authenticated(String username) {
        return UsernamePasswordAuthenticationToken.authenticated(
                username, null, java.util.List.of());
    }
}
