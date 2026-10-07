package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.OrganizationGroupEntity;
import io.github.susimsek.kitezh.domain.OrganizationGroupMemberEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationGroupMemberRepository;
import io.github.susimsek.kitezh.repository.OrganizationGroupRepository;
import io.github.susimsek.kitezh.repository.OrganizationMemberRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationGroupServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationGroupRepository groupRepository;
    @Mock private OrganizationGroupMemberRepository memberRepository;
    @Mock private OrganizationMemberRepository organizationMemberRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;
    @Mock private AdminAuditEventService adminAuditEventService;

    @Test
    void createsListsUpdatesAndManagesMembers() {
        OrganizationEntity organization = organization(8L);
        OrganizationGroupEntity group = group(4L, organization);
        UserEntity user = user(2L);
        OrganizationGroupMemberEntity member = groupMember(5L, group, user);
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(groupRepository.existsByOrganizationIdAndNameIgnoreCase(8L, "Finance"))
                .thenReturn(false);
        when(groupRepository.save(any(OrganizationGroupEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationGroupEntity saved = invocation.getArgument(0);
                            saved.setId(4L);
                            return saved;
                        });
        when(groupRepository.searchByOrganizationId(8L, "fi", Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of(group)));
        when(groupRepository.findById(4L)).thenReturn(Optional.of(group));
        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(organizationMemberRepository.existsByOrganizationIdAndUserId(8L, 2L)).thenReturn(true);
        when(memberRepository.existsByGroupIdAndUserId(4L, 2L)).thenReturn(false);
        when(memberRepository.save(any(OrganizationGroupMemberEntity.class))).thenReturn(member);
        when(memberRepository.searchByGroupId(4L, "us", Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of(member)));
        when(memberRepository.findByGroupIdAndUserId(4L, 2L)).thenReturn(Optional.of(member));

        var created =
                service()
                        .create(
                                8L,
                                new AdminOrganizationGroupRequestDTO(
                                        " Finance ", "Accounting", true, Set.of("ROLE_FINANCE")));
        var listed = service().findAll(8L, " fi ", Pageable.ofSize(20));
        var updated =
                service()
                        .update(
                                8L,
                                4L,
                                new AdminOrganizationGroupRequestDTO(
                                        "Finance", "Updated", false, Set.of("ROLE_REVIEWER")));
        var added = service().addMember(8L, 4L, 2L);
        var members = service().findMembers(8L, 4L, " us ", Pageable.ofSize(20));
        service().removeMember(8L, 4L, 2L);

        assertThat(created.name()).isEqualTo("Finance");
        assertThat(created.roles()).containsExactly("role_finance");
        assertThat(listed.getContent()).hasSize(1);
        assertThat(updated.enabled()).isFalse();
        assertThat(added.username()).isEqualTo("user");
        assertThat(members.getContent()).hasSize(1);
        verify(memberRepository).delete(member);
        verify(userAccessInvalidationService, org.mockito.Mockito.times(2)).invalidate("user");
    }

    @Test
    void rejectsDuplicatesMissingOrganizationMembershipAndUnknownGroup() {
        OrganizationEntity organization = organization(8L);
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(groupRepository.existsByOrganizationIdAndNameIgnoreCase(8L, "Finance"))
                .thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                8L,
                                                new AdminOrganizationGroupRequestDTO(
                                                        "Finance", null, true, Set.of())))
                .isInstanceOf(ApiException.class);

        OrganizationGroupEntity group = group(4L, organization);
        UserEntity user = user(2L);
        when(groupRepository.findById(4L)).thenReturn(Optional.of(group));
        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(organizationMemberRepository.existsByOrganizationIdAndUserId(8L, 2L))
                .thenReturn(false);
        assertThatThrownBy(() -> service().addMember(8L, 4L, 2L)).isInstanceOf(ApiException.class);
        when(groupRepository.findById(9L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().findById(8L, 9L)).isInstanceOf(ApiException.class);
    }

    private AdminOrganizationGroupService service() {
        return new AdminOrganizationGroupService(
                organizationRepository,
                groupRepository,
                memberRepository,
                organizationMemberRepository,
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

    private static OrganizationGroupEntity group(Long id, OrganizationEntity organization) {
        OrganizationGroupEntity entity = new OrganizationGroupEntity();
        entity.setId(id);
        entity.setOrganization(organization);
        entity.setName("Finance");
        entity.setEnabled(true);
        entity.setRoles(new LinkedHashSet<>(List.of("role_finance")));
        return entity;
    }

    private static OrganizationGroupMemberEntity groupMember(
            Long id, OrganizationGroupEntity group, UserEntity user) {
        OrganizationGroupMemberEntity entity = new OrganizationGroupMemberEntity();
        entity.setId(id);
        entity.setGroup(group);
        entity.setUser(user);
        return entity;
    }

    private static UserEntity user(Long id) {
        UserEntity entity = new UserEntity();
        entity.setId(id);
        entity.setUsername("user");
        entity.setEmail("user@example.com");
        return entity;
    }
}
