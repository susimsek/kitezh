package io.github.susimsek.springauthserversamples.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.dto.admin.AdminOfflineAccessPolicyDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminOfflineAccessPolicyRequestDTO;
import io.github.susimsek.springauthserversamples.service.admin.OfflineAccessPolicyService;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class AdminOfflineAccessPolicyControllerTest {

    private final OfflineAccessPolicyService service = mock(OfflineAccessPolicyService.class);
    private final AdminOfflineAccessPolicyController controller =
            new AdminOfflineAccessPolicyController(service);
    private final AdminOfflineAccessPolicyDTO policy =
            new AdminOfflineAccessPolicyDTO(Duration.ofDays(30), null, false, null);

    @Test
    void delegatesPolicyOperations() {
        when(service.get()).thenReturn(policy);
        when(service.update(org.mockito.ArgumentMatchers.any())).thenReturn(policy);
        when(service.revokeAll())
                .thenReturn(
                        new AdminOfflineAccessPolicyDTO(
                                Duration.ofDays(30),
                                null,
                                false,
                                Instant.parse("2026-01-01T00:00:00Z")));

        assertThat(controller.get()).isSameAs(policy);
        assertThat(
                        controller
                                .update(
                                        new AdminOfflineAccessPolicyRequestDTO(
                                                Duration.ofDays(30), null, false))
                                .maxLimited())
                .isFalse();
        assertThat(controller.revokeAll().getStatusCode()).isEqualTo(HttpStatus.OK);

        verify(service).get();
        verify(service).update(org.mockito.ArgumentMatchers.any());
        verify(service).revokeAll();
    }
}
