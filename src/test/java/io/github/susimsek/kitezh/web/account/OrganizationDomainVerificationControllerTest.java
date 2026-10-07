package io.github.susimsek.kitezh.web.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationDomainVerificationStatus;
import io.github.susimsek.kitezh.dto.account.OrganizationDomainVerificationRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainVerificationDTO;
import io.github.susimsek.kitezh.service.admin.OrganizationDomainVerificationService;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OrganizationDomainVerificationControllerTest {

    @Mock private OrganizationDomainVerificationService verificationService;

    @Test
    void verifiesDomainFromRequestAndEmailLink() {
        var controller = new OrganizationDomainVerificationController(verificationService);
        var result =
                new AdminOrganizationDomainVerificationDTO(
                        3L,
                        OrganizationDomainVerificationStatus.VERIFIED,
                        Instant.now(),
                        Instant.now());
        when(verificationService.verify("request-token")).thenReturn(result);
        when(verificationService.verify("email-token")).thenReturn(result);

        assertThat(controller.verify(new OrganizationDomainVerificationRequestDTO("request-token")))
                .isEqualTo(result);
        assertThat(controller.verifyFromEmail("email-token")).isEqualTo(result);

        verify(verificationService).verify("request-token");
        verify(verificationService).verify("email-token");
    }
}
