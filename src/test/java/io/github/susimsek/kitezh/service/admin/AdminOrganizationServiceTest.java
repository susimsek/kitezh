package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.OrganizationMemberEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationClaimRepository;
import io.github.susimsek.kitezh.repository.OrganizationDomainRepository;
import io.github.susimsek.kitezh.repository.OrganizationGroupMemberRepository;
import io.github.susimsek.kitezh.repository.OrganizationGroupRepository;
import io.github.susimsek.kitezh.repository.OrganizationIdentityProviderRepository;
import io.github.susimsek.kitezh.repository.OrganizationInvitationRepository;
import io.github.susimsek.kitezh.repository.OrganizationMemberRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationMemberRepository memberRepository;
    @Mock private OrganizationDomainRepository domainRepository;
    @Mock private OrganizationInvitationRepository invitationRepository;
    @Mock private OrganizationGroupRepository groupRepository;
    @Mock private OrganizationGroupMemberRepository groupMemberRepository;
    @Mock private OrganizationClaimRepository claimRepository;
    @Mock private OrganizationIdentityProviderRepository providerRepository;
    @Mock private SocialProviderRepository socialProviderRepository;
    @Mock private UserRepository userRepository;
    @Mock private AdminAuditEventService auditEventService;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;
    @InjectMocks private AdminOrganizationService service;

    @Test
    void rejectsDuplicateOrganizationAlias() {
        when(organizationRepository.existsByAliasIgnoreCase("acme")).thenReturn(true);

        assertThatThrownBy(
                        () ->
                                service.create(
                                        new AdminOrganizationRequestDTO(
                                                "acme", "Acme", null, null, true)))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_DUPLICATE_ALIAS);
    }

    @Test
    void addsUserAsOrganizationMember() {
        OrganizationEntity organization = new OrganizationEntity();
        organization.setId(10L);
        UserEntity user = new UserEntity();
        user.setId(20L);
        user.setUsername("alice");
        user.setEmail("alice@example.com");
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));
        when(memberRepository.existsByOrganizationIdAndUserId(10L, 20L)).thenReturn(false);
        when(userRepository.findById(20L)).thenReturn(Optional.of(user));
        when(memberRepository.save(any(OrganizationMemberEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationMemberEntity member = invocation.getArgument(0);
                            member.setId(30L);
                            return member;
                        });

        var result = service.addMember(10L, new AdminOrganizationMemberRequestDTO(20L, "admin"));

        assertThat(result.userId()).isEqualTo(20L);
        assertThat(result.username()).isEqualTo("alice");
        assertThat(result.role()).isEqualTo("ADMIN");
        verify(auditEventService).record("organization.member.added", "organization", "10");
    }

    @Test
    void rejectsInvalidOrganizationDomain() {
        OrganizationEntity organization = new OrganizationEntity();
        organization.setId(10L);
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(organization));

        assertThatThrownBy(
                        () ->
                                service.addDomain(
                                        10L,
                                        new AdminOrganizationDomainRequestDTO(
                                                "https://example.com")))
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.ORGANIZATION_INVALID_DOMAIN);
    }
}
