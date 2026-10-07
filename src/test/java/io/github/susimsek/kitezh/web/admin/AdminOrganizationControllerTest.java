package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationControllerTest {

    @Mock private AdminOrganizationService organizationService;

    @Test
    void delegatesOrganizationOperations() {
        AdminOrganizationController controller =
                new AdminOrganizationController(organizationService);
        AdminOrganizationDTO organization =
                new AdminOrganizationDTO(8L, "acme", "Acme", null, null, true, Map.of());
        AdminOrganizationRequestDTO request =
                new AdminOrganizationRequestDTO("acme", "Acme", null, null, true, Map.of());
        Pageable pageable = Pageable.ofSize(20);
        when(organizationService.findAll("acme", pageable))
                .thenReturn(new PageImpl<>(List.of(organization)));
        when(organizationService.findById(8L)).thenReturn(organization);
        when(organizationService.create(request)).thenReturn(organization);
        when(organizationService.update(8L, request)).thenReturn(organization);

        assertThat(controller.findAll("acme", pageable).getContent()).containsExactly(organization);
        assertThat(controller.findById(8L)).isEqualTo(organization);
        var created = controller.create(request);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getHeaders().getLocation()).hasPath("/api/admin/organizations/8");
        assertThat(created.getBody()).isEqualTo(organization);
        assertThat(controller.update(8L, request)).isEqualTo(organization);
        verify(organizationService).findAll("acme", pageable);
    }
}
