package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationDomainVerificationStatus;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainVerificationDTO;
import io.github.susimsek.kitezh.service.admin.OrganizationDomainVerificationService;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationDomainVerificationControllerTest {

    @Mock private OrganizationDomainVerificationService verificationService;

    @Test
    void startsDomainVerification() {
        var controller = new AdminOrganizationDomainVerificationController(verificationService);
        var result =
                new AdminOrganizationDomainVerificationDTO(
                        4L, OrganizationDomainVerificationStatus.PENDING, Instant.now(), null);
        when(verificationService.start(7L, 4L)).thenReturn(result);

        assertThat(controller.start(7L, 4L)).isEqualTo(result);

        verify(verificationService).start(7L, 4L);
    }
}
