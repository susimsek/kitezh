package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminLoginSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLoginSettingsRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRegistrationCaptchaDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRegistrationCaptchaRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSocialProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSocialProvidersRequestDTO;
import io.github.susimsek.kitezh.dto.admin.LocalizationMessageOverrideDTO;
import io.github.susimsek.kitezh.dto.admin.LocalizationMessageOverrideRequestDTO;
import io.github.susimsek.kitezh.dto.admin.LocalizationSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.LocalizationSettingsRequestDTO;
import io.github.susimsek.kitezh.dto.userprofile.UserProfileAttributeDefinitionDTO;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService;
import io.github.susimsek.kitezh.service.UserProfileService;
import io.github.susimsek.kitezh.service.admin.LocalizationSettingsService;
import io.github.susimsek.kitezh.service.security.RegistrationCaptchaSettingsService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

class AdminSettingsControllerTest {

    @Test
    void delegatesLocalizationOperations() {
        LocalizationSettingsService service = mock(LocalizationSettingsService.class);
        AdminLocalizationController controller = new AdminLocalizationController(service);
        LocalizationSettingsDTO settings = mock(LocalizationSettingsDTO.class);
        LocalizationMessageOverrideDTO message = mock(LocalizationMessageOverrideDTO.class);
        PageRequest pageable = PageRequest.of(0, 20);
        Page<LocalizationMessageOverrideDTO> messages = Page.empty(pageable);
        Map<String, String> bundled = Map.of("login.title", "Sign in");
        LocalizationSettingsRequestDTO settingsRequest = mock(LocalizationSettingsRequestDTO.class);
        LocalizationMessageOverrideRequestDTO messageRequest =
                mock(LocalizationMessageOverrideRequestDTO.class);

        when(service.get()).thenReturn(settings);
        when(service.update(settingsRequest)).thenReturn(settings);
        when(service.overrides("login", "tr", "admin", pageable)).thenReturn(messages);
        when(service.bundledMessages("tr", "admin")).thenReturn(bundled);
        when(service.create(messageRequest)).thenReturn(message);
        when(service.updateMessageOverride(7L, messageRequest)).thenReturn(message);

        assertThat(controller.get()).isSameAs(settings);
        assertThat(controller.update(settingsRequest)).isSameAs(settings);
        assertThat(controller.messages("login", "tr", "admin", pageable)).isSameAs(messages);
        assertThat(controller.bundled("tr", "admin")).isSameAs(bundled);
        assertThat(controller.create(messageRequest).getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(controller.updateMessage(7L, messageRequest)).isSameAs(message);
        assertThat(controller.delete(7L).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(service).delete(7L);
    }

    @Test
    void delegatesLoginAndRegistrationSettings() {
        LoginSettingsService loginService = mock(LoginSettingsService.class);
        AdminLoginSettingsController loginController =
                new AdminLoginSettingsController(loginService);
        AdminLoginSettingsDTO loginSettings = mock(AdminLoginSettingsDTO.class);
        AdminLoginSettingsRequestDTO loginRequest = mock(AdminLoginSettingsRequestDTO.class);
        when(loginService.adminLoginSettings()).thenReturn(loginSettings);
        when(loginService.update(loginRequest)).thenReturn(loginSettings);

        assertThat(loginController.get()).isSameAs(loginSettings);
        assertThat(loginController.update(loginRequest)).isSameAs(loginSettings);

        RegistrationCaptchaSettingsService captchaService =
                mock(RegistrationCaptchaSettingsService.class);
        AdminRegistrationCaptchaController captchaController =
                new AdminRegistrationCaptchaController(captchaService);
        AdminRegistrationCaptchaDTO captchaSettings = mock(AdminRegistrationCaptchaDTO.class);
        AdminRegistrationCaptchaRequestDTO captchaRequest =
                mock(AdminRegistrationCaptchaRequestDTO.class);
        when(captchaService.adminSettings()).thenReturn(captchaSettings);
        when(captchaService.update(captchaRequest)).thenReturn(captchaSettings);

        assertThat(captchaController.get()).isSameAs(captchaSettings);
        assertThat(captchaController.update(captchaRequest)).isSameAs(captchaSettings);
        verify(captchaService).update(captchaRequest);
    }

    @Test
    void delegatesSocialProviderAndProfileAttributeOperations() {
        SocialProviderSettingsService socialService = mock(SocialProviderSettingsService.class);
        AdminSocialProviderController socialController =
                new AdminSocialProviderController(socialService);
        List<AdminSocialProviderDTO> providers = List.of(mock(AdminSocialProviderDTO.class));
        AdminSocialProvidersRequestDTO socialRequest = mock(AdminSocialProvidersRequestDTO.class);
        when(socialService.adminSettings()).thenReturn(providers);
        when(socialService.update(socialRequest)).thenReturn(providers);

        assertThat(socialController.get()).isSameAs(providers);
        assertThat(socialController.update(socialRequest)).isSameAs(providers);

        UserProfileService profileService = mock(UserProfileService.class);
        AdminProfileAttributeController profileController =
                new AdminProfileAttributeController(profileService);
        List<UserProfileAttributeDefinitionDTO> definitions =
                List.of(mock(UserProfileAttributeDefinitionDTO.class));
        when(profileService.definitions(true)).thenReturn(definitions);

        assertThat(profileController.definitions()).isSameAs(definitions);
        verify(profileService).definitions(true);
    }
}
