package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

class AdminOrganizationControllerTest {

    private final AdminOrganizationService service = mock(AdminOrganizationService.class);
    private final AdminOrganizationController controller = new AdminOrganizationController(service);

    @Test
    void delegatesOrganizationCrudAndMembershipOperations() {
        PageRequest pageable = PageRequest.of(0, 20);
        AdminOrganizationDTO organization = mock(AdminOrganizationDTO.class);
        AdminOrganizationMemberDTO member = mock(AdminOrganizationMemberDTO.class);
        when(organization.id()).thenReturn(7L);
        when(service.findAll("acme", pageable)).thenReturn(Page.empty(pageable));
        when(service.findById(7L)).thenReturn(organization);
        when(service.create(any(AdminOrganizationRequestDTO.class))).thenReturn(organization);
        when(service.update(eq(7L), any(AdminOrganizationRequestDTO.class)))
                .thenReturn(organization);
        when(service.members(7L, "alice", pageable)).thenReturn(Page.empty(pageable));
        when(service.addMember(eq(7L), any())).thenReturn(member);

        assertThat(controller.findAll("acme", pageable)).isEmpty();
        assertThat(controller.findById(7L)).isSameAs(organization);
        assertThat(controller.create(mock(AdminOrganizationRequestDTO.class)).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        assertThat(controller.update(7L, mock(AdminOrganizationRequestDTO.class)))
                .isSameAs(organization);
        assertThat(controller.members(7L, "alice", pageable)).isEmpty();
        assertThat(controller.addMember(7L, mock())).isSameAs(member);
        assertThat(controller.delete(7L).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.removeMember(7L, 20L).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        verify(service).delete(7L);
        verify(service).removeMember(7L, 20L);
    }

    @Test
    void exposesOrganizationSubresources() {
        when(service.domains(7L)).thenReturn(List.of());
        when(service.claims(7L)).thenReturn(List.of());
        when(service.identityProviders(7L)).thenReturn(List.of());

        assertThat(controller.domains(7L)).isEmpty();
        assertThat(controller.claims(7L)).isEmpty();
        assertThat(controller.identityProviders(7L)).isEmpty();
        verify(service).domains(7L);
        verify(service).claims(7L);
        verify(service).identityProviders(7L);
    }
}
