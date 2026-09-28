package io.github.susimsek.springauthserversamples.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.LdapFederationMapperType;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapConnectionTestRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapMapperDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapMapperRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapProviderDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapProviderRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapProvidersRequestDTO;
import io.github.susimsek.springauthserversamples.service.LdapFederationMapperAdminService;
import io.github.susimsek.springauthserversamples.service.LdapFederationSettingsService;
import io.github.susimsek.springauthserversamples.service.LdapFederationSyncService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class AdminLdapFederationControllerTest {

    private final LdapFederationSettingsService settingsService =
            mock(LdapFederationSettingsService.class);
    private final LdapFederationMapperAdminService mapperAdminService =
            mock(LdapFederationMapperAdminService.class);
    private final LdapFederationSyncService syncService = mock(LdapFederationSyncService.class);
    private final AdminLdapFederationController controller =
            new AdminLdapFederationController(settingsService, mapperAdminService, syncService);

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

    @Test
    void managesMappersAndSynchronizesProvider() {
        AdminLdapMapperRequestDTO request =
                new AdminLdapMapperRequestDTO(
                        null,
                        "Department",
                        LdapFederationMapperType.USER_ATTRIBUTE,
                        true,
                        "department",
                        "department",
                        null,
                        null,
                        null,
                        null,
                        null,
                        null);
        AdminLdapMapperDTO mapper =
                new AdminLdapMapperDTO(
                        5L,
                        "Department",
                        LdapFederationMapperType.USER_ATTRIBUTE,
                        true,
                        "department",
                        "department",
                        null,
                        null,
                        null,
                        null,
                        null,
                        null);
        when(mapperAdminService.list("provider-id")).thenReturn(List.of(mapper));
        when(mapperAdminService.save(eq("provider-id"), any(AdminLdapMapperRequestDTO.class)))
                .thenReturn(mapper);
        when(syncService.synchronize("provider-id", LdapFederationSyncService.SyncMode.CHANGED))
                .thenReturn(
                        new LdapFederationSyncService.SyncResult(
                                "provider-id",
                                LdapFederationSyncService.SyncMode.CHANGED,
                                "SUCCESS",
                                1,
                                2,
                                null));

        assertThat(controller.mappers("provider-id")).containsExactly(mapper);
        assertThat(controller.createMapper("provider-id", request)).isSameAs(mapper);
        assertThat(controller.updateMapper("provider-id", 5L, request)).isSameAs(mapper);
        assertThat(controller.deleteMapper("provider-id", 5L).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.sync("provider-id", LdapFederationSyncService.SyncMode.CHANGED))
                .extracting(LdapFederationSyncService.SyncResult::status)
                .isEqualTo("SUCCESS");
        verify(mapperAdminService).delete("provider-id", 5L);
        verify(syncService).synchronize("provider-id", LdapFederationSyncService.SyncMode.CHANGED);
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
