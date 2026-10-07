package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationDomainService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationDomainControllerTest {

    @Mock private AdminOrganizationDomainService domainService;

    @Test
    void delegatesDomainOperations() {
        AdminOrganizationDomainController controller =
                new AdminOrganizationDomainController(domainService);
        AdminOrganizationDomainDTO domain = new AdminOrganizationDomainDTO(3L, "acme.com");
        AdminOrganizationDomainRequestDTO request =
                new AdminOrganizationDomainRequestDTO("acme.com");
        Pageable pageable = Pageable.ofSize(20);
        when(domainService.findAll(8L, pageable)).thenReturn(new PageImpl<>(List.of(domain)));
        when(domainService.add(8L, request)).thenReturn(domain);

        assertThat(controller.findAll(8L, pageable).getContent()).containsExactly(domain);
        var added = controller.add(8L, request);
        assertThat(added.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(added.getHeaders().getLocation())
                .hasPath("/api/admin/organizations/8/domains/3");
        assertThat(controller.remove(8L, 3L).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }
}
