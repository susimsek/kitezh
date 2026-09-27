package io.github.susimsek.springauthserversamples.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapConnectionTestRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapProviderDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapProviderRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapProvidersRequestDTO;
import io.github.susimsek.springauthserversamples.service.LdapFederationSettingsService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class AdminLdapFederationControllerTest {

    private final LdapFederationSettingsService settingsService =
            mock(LdapFederationSettingsService.class);
    private final AdminLdapFederationController controller =
            new AdminLdapFederationController(settingsService);

    @Test
    void returnsConfiguredProviders() {
        List<AdminLdapProviderDTO> providers = List.of(provider());
        when(settingsService.adminSettings()).thenReturn(providers);

        assertThat(controller.get()).isSameAs(providers);
    }

    @Test
    void updatesProviders() {
        AdminLdapProvidersRequestDTO request =
                new AdminLdapProvidersRequestDTO(List.of(request(null)));
        List<AdminLdapProviderDTO> providers = List.of(provider());
        when(settingsService.update(request)).thenReturn(providers);

        assertThat(controller.update(request)).isSameAs(providers);
    }

    @Test
    void testsAndDeletesProviderWithNoContentResponses() {
        AdminLdapConnectionTestRequestDTO testRequest =
                new AdminLdapConnectionTestRequestDTO(request(null));

        assertThat(controller.test(testRequest).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.delete("provider-id").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(settingsService).test(testRequest);
        verify(settingsService).delete("provider-id");
    }

    private static AdminLdapProviderDTO provider() {
        return new AdminLdapProviderDTO(
                "provider-id",
                "Corporate AD",
                false,
                10,
                "ldaps://directory.example.com:636",
                "CN=bind,DC=example,DC=com",
                true,
                "OU=Users,DC=example,DC=com",
                "sAMAccountName",
                "objectGUID",
                "mail",
                "givenName",
                "sn",
                "sAMAccountName",
                "person,user",
                "SUBTREE",
                "READ_ONLY",
                true,
                false);
    }

    private static AdminLdapProviderRequestDTO request(String id) {
        return new AdminLdapProviderRequestDTO(
                id,
                "Corporate AD",
                false,
                10,
                "ldaps://directory.example.com:636",
                "CN=bind,DC=example,DC=com",
                "bind-password",
                "OU=Users,DC=example,DC=com",
                "sAMAccountName",
                "objectGUID",
                "mail",
                "givenName",
                "sn",
                "sAMAccountName",
                "person,user",
                "SUBTREE",
                "READ_ONLY",
                true,
                false);
    }
}
