package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationPermissionLevel;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationPermissionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationPermissionRequestDTO;
import io.github.susimsek.kitezh.service.admin.OrganizationPermissionService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationPermissionControllerTest {

    @Mock private OrganizationPermissionService permissionService;

    @Test
    void delegatesPermissionQueriesAndUpdates() {
        var controller = new AdminOrganizationPermissionController(permissionService);
        Pageable pageable = Pageable.ofSize(20);
        var permission =
                new AdminOrganizationPermissionDTO(
                        1L, 10L, "org-manager", OrganizationPermissionLevel.MANAGE);
        Page<AdminOrganizationPermissionDTO> page = new PageImpl<>(List.of(permission));
        var request =
                new AdminOrganizationPermissionRequestDTO(10L, OrganizationPermissionLevel.MANAGE);
        when(permissionService.findAll(7L, pageable)).thenReturn(page);
        when(permissionService.upsert(7L, request)).thenReturn(permission);

        assertThat(controller.findAll(7L, pageable)).isSameAs(page);
        assertThat(controller.upsert(7L, request)).isEqualTo(permission);

        verify(permissionService).findAll(7L, pageable);
        verify(permissionService).upsert(7L, request);
    }
}
