package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminOrganizationIdentityProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationIdentityProviderRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationIdentityProviderService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationIdentityProviderControllerTest {

    @Mock private AdminOrganizationIdentityProviderService identityProviderService;

    @Test
    void delegatesIdentityProviderOperations() {
        AdminOrganizationIdentityProviderController controller =
                new AdminOrganizationIdentityProviderController(identityProviderService);
        AdminOrganizationIdentityProviderDTO binding =
                new AdminOrganizationIdentityProviderDTO(4L, "google", true);
        AdminOrganizationIdentityProviderRequestDTO request =
                new AdminOrganizationIdentityProviderRequestDTO("google", true);
        Pageable pageable = Pageable.ofSize(20);
        when(identityProviderService.findAll(8L, pageable))
                .thenReturn(new PageImpl<>(List.of(binding)));
        when(identityProviderService.add(8L, request)).thenReturn(binding);
        when(identityProviderService.update(8L, 4L, request)).thenReturn(binding);

        assertThat(controller.findAll(8L, pageable).getContent()).containsExactly(binding);
        assertThat(controller.add(8L, request).getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(controller.update(8L, 4L, request)).isEqualTo(binding);
        assertThat(controller.remove(8L, 4L).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }
}
