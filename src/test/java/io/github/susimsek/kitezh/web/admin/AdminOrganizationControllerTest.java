package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminOrganizationClaimDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationClaimRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationIdentityProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationIdentityProviderRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberRequestDTO;
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

    @Test
    void delegatesAllOrganizationSubresourceOperations() {
        PageRequest pageable = PageRequest.of(0, 20);
        AdminOrganizationMemberDTO member = mock(AdminOrganizationMemberDTO.class);
        AdminOrganizationDomainDTO domain = mock(AdminOrganizationDomainDTO.class);
        AdminOrganizationInvitationDTO invitation = mock(AdminOrganizationInvitationDTO.class);
        AdminOrganizationGroupDTO group = mock(AdminOrganizationGroupDTO.class);
        AdminOrganizationClaimDTO claim = mock(AdminOrganizationClaimDTO.class);
        AdminOrganizationIdentityProviderDTO provider =
                mock(AdminOrganizationIdentityProviderDTO.class);

        when(service.updateMember(eq(7L), eq(20L), any(AdminOrganizationMemberRequestDTO.class)))
                .thenReturn(member);
        when(service.addDomain(eq(7L), any(AdminOrganizationDomainRequestDTO.class)))
                .thenReturn(domain);
        when(service.verifyDomain(eq(7L), eq(8L))).thenReturn(domain);
        when(service.invitations(7L, pageable)).thenReturn(Page.empty(pageable));
        when(service.createInvitation(eq(7L), any(AdminOrganizationInvitationRequestDTO.class)))
                .thenReturn(invitation);
        when(service.groups(7L, "eng", pageable)).thenReturn(Page.empty(pageable));
        when(service.createGroup(eq(7L), any(AdminOrganizationGroupRequestDTO.class)))
                .thenReturn(group);
        when(service.updateGroup(eq(7L), eq(9L), any(AdminOrganizationGroupRequestDTO.class)))
                .thenReturn(group);
        when(service.groupMembers(7L, 9L, "alice", pageable)).thenReturn(Page.empty(pageable));
        when(service.availableGroupMembers(7L, 9L, "", pageable)).thenReturn(Page.empty(pageable));
        when(service.createClaim(eq(7L), any(AdminOrganizationClaimRequestDTO.class)))
                .thenReturn(claim);
        when(service.updateClaim(eq(7L), eq(10L), any(AdminOrganizationClaimRequestDTO.class)))
                .thenReturn(claim);
        when(service.addIdentityProvider(7L, "google")).thenReturn(provider);

        assertThat(controller.updateMember(7L, 20L, mock(AdminOrganizationMemberRequestDTO.class)))
                .isSameAs(member);
        assertThat(controller.addDomain(7L, mock(AdminOrganizationDomainRequestDTO.class)))
                .isSameAs(domain);
        assertThat(controller.verifyDomain(7L, 8L)).isSameAs(domain);
        assertThat(controller.removeDomain(7L, 8L).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.invitations(7L, pageable)).isEmpty();
        assertThat(
                        controller.createInvitation(
                                7L, mock(AdminOrganizationInvitationRequestDTO.class)))
                .isSameAs(invitation);
        assertThat(controller.revokeInvitation(7L, 8L).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.groups(7L, "eng", pageable)).isEmpty();
        assertThat(controller.createGroup(7L, mock(AdminOrganizationGroupRequestDTO.class)))
                .isSameAs(group);
        assertThat(controller.updateGroup(7L, 9L, mock(AdminOrganizationGroupRequestDTO.class)))
                .isSameAs(group);
        assertThat(controller.deleteGroup(7L, 9L).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.groupMembers(7L, 9L, "alice", pageable)).isEmpty();
        assertThat(controller.availableGroupMembers(7L, 9L, "", pageable)).isEmpty();
        assertThat(controller.addGroupMember(7L, 9L, 20L).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.removeGroupMember(7L, 9L, 20L).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.createClaim(7L, mock(AdminOrganizationClaimRequestDTO.class)))
                .isSameAs(claim);
        assertThat(controller.updateClaim(7L, 10L, mock(AdminOrganizationClaimRequestDTO.class)))
                .isSameAs(claim);
        assertThat(controller.deleteClaim(7L, 10L).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(
                        controller.addIdentityProvider(
                                7L, new AdminOrganizationIdentityProviderRequestDTO("google")))
                .isSameAs(provider);
        assertThat(controller.removeIdentityProvider(7L, "google").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        verify(service).removeDomain(7L, 8L);
        verify(service).revokeInvitation(7L, 8L);
        verify(service).deleteGroup(7L, 9L);
        verify(service).addGroupMember(7L, 9L, 20L);
        verify(service).removeGroupMember(7L, 9L, 20L);
        verify(service).deleteClaim(7L, 10L);
        verify(service).removeIdentityProvider(7L, "google");
    }
}
