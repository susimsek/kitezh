package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.OrganizationMemberEntity;
import io.github.susimsek.kitezh.domain.OrganizationMembershipType;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationMemberRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationMemberServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationMemberRepository memberRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;
    @Mock private AdminAuditEventService adminAuditEventService;

    @Test
    void listsAndAddsOrganizationMember() {
        OrganizationEntity organization = organization(8L);
        UserEntity user = user(2L, "user");
        OrganizationMemberEntity member =
                member(4L, organization, user, OrganizationMembershipType.UNMANAGED);
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(memberRepository.searchByOrganizationId(8L, "us", Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of(member)));
        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(memberRepository.existsByOrganizationIdAndUserId(8L, 2L)).thenReturn(false);
        when(memberRepository.save(any(OrganizationMemberEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationMemberEntity saved = invocation.getArgument(0);
                            saved.setId(5L);
                            return saved;
                        });

        var listed = service().findAll(8L, " us ", Pageable.ofSize(20));
        var added = service().add(8L, new AdminOrganizationMemberRequestDTO(2L, null));

        assertThat(listed.getContent()).hasSize(1);
        assertThat(listed.getContent().getFirst().username()).isEqualTo("user");
        assertThat(added.id()).isEqualTo(5L);
        assertThat(added.membershipType()).isEqualTo(OrganizationMembershipType.UNMANAGED);
        verify(userAccessInvalidationService).invalidate("user");
        verify(adminAuditEventService)
                .record("organization.member.added", "organization", "8", "userId=2");
    }

    @Test
    void updatesAndRemovesMember() {
        OrganizationEntity organization = organization(8L);
        UserEntity user = user(2L, "user");
        OrganizationMemberEntity member =
                member(4L, organization, user, OrganizationMembershipType.UNMANAGED);
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(memberRepository.findByOrganizationIdAndUserId(8L, 2L))
                .thenReturn(Optional.of(member));

        var updated =
                service()
                        .update(
                                8L,
                                2L,
                                new AdminOrganizationMemberRequestDTO(
                                        2L, OrganizationMembershipType.MANAGED));
        service().remove(8L, 2L);

        assertThat(updated.membershipType()).isEqualTo(OrganizationMembershipType.MANAGED);
        verify(memberRepository).delete(member);
        verify(userAccessInvalidationService, org.mockito.Mockito.times(2)).invalidate("user");
        verify(adminAuditEventService)
                .record("organization.member.updated", "organization", "8", "userId=2");
        verify(adminAuditEventService)
                .record("organization.member.removed", "organization", "8", "userId=2");
    }

    @Test
    void rejectsDuplicateAndUnknownMemberOperations() {
        OrganizationEntity organization = organization(8L);
        UserEntity user = user(2L, "user");
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(memberRepository.existsByOrganizationIdAndUserId(8L, 2L)).thenReturn(true);

        assertThatThrownBy(() -> service().add(8L, new AdminOrganizationMemberRequestDTO(2L, null)))
                .isInstanceOf(ApiException.class);

        when(memberRepository.findByOrganizationIdAndUserId(8L, 9L)).thenReturn(Optional.empty());
        assertThatThrownBy(
                        () ->
                                service()
                                        .update(
                                                8L,
                                                9L,
                                                new AdminOrganizationMemberRequestDTO(9L, null)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service().remove(8L, 9L)).isInstanceOf(ApiException.class);
    }

    private AdminOrganizationMemberService service() {
        return new AdminOrganizationMemberService(
                organizationRepository,
                memberRepository,
                userRepository,
                userAccessInvalidationService,
                adminAuditEventService);
    }

    private static OrganizationEntity organization(Long id) {
        OrganizationEntity entity = new OrganizationEntity();
        entity.setId(id);
        entity.setAlias("acme");
        entity.setName("Acme");
        return entity;
    }

    private static UserEntity user(Long id, String username) {
        UserEntity entity = new UserEntity();
        entity.setId(id);
        entity.setUsername(username);
        entity.setEmail(username + "@example.com");
        return entity;
    }

    private static OrganizationMemberEntity member(
            Long id,
            OrganizationEntity organization,
            UserEntity user,
            OrganizationMembershipType type) {
        OrganizationMemberEntity entity = new OrganizationMemberEntity();
        entity.setId(id);
        entity.setOrganization(organization);
        entity.setUser(user);
        entity.setMembershipType(type);
        return entity;
    }
}
