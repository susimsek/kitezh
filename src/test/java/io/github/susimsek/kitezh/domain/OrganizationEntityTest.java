package io.github.susimsek.kitezh.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class OrganizationEntityTest {

    @Test
    void organizationEntitiesExposeTheirState() {
        Instant joinedAt = Instant.EPOCH;
        Instant verifiedAt = joinedAt.plusSeconds(1);
        OrganizationEntity organization = new OrganizationEntity();
        UserEntity user = new UserEntity();
        OrganizationGroupEntity parent = new OrganizationGroupEntity();
        OrganizationGroupEntity group = new OrganizationGroupEntity();
        OrganizationMemberEntity member = new OrganizationMemberEntity();
        OrganizationDomainEntity domain = new OrganizationDomainEntity();
        OrganizationInvitationEntity invitation = new OrganizationInvitationEntity();
        OrganizationGroupMemberEntity groupMember = new OrganizationGroupMemberEntity();
        OrganizationClaimEntity claim = new OrganizationClaimEntity();
        OrganizationIdentityProviderEntity provider = new OrganizationIdentityProviderEntity();

        organization.setId(1L);
        organization.setAlias("acme");
        organization.setName("Acme");
        organization.setDisplayName("Acme Corporation");
        organization.setDescription("Description");
        organization.setEnabled(false);

        member.setId(2L);
        member.setOrganization(organization);
        member.setUser(user);
        member.setRole("ADMIN");
        member.setJoinedAt(joinedAt);

        domain.setId(3L);
        domain.setOrganization(organization);
        domain.setDomain("acme.example.com");
        domain.setVerified(true);
        domain.setVerificationToken("token");
        domain.setVerifiedAt(verifiedAt);

        invitation.setId(4L);
        invitation.setOrganization(organization);
        invitation.setEmail("alice@example.com");
        invitation.setRole("ADMIN");
        invitation.setTokenHash("hash");
        invitation.setExpiresAt(verifiedAt);
        invitation.setAcceptedAt(joinedAt);
        invitation.setRevokedAt(verifiedAt);
        invitation.setCreatedAt(joinedAt);

        parent.setId(5L);
        group.setId(6L);
        group.setOrganization(organization);
        group.setParent(parent);
        group.setName("engineering");

        groupMember.setId(7L);
        groupMember.setGroup(group);
        groupMember.setUser(user);
        groupMember.setJoinedAt(joinedAt);

        claim.setId(8L);
        claim.setOrganization(organization);
        claim.setClaimName("organization");
        claim.setClaimValue("acme");
        claim.setAddToAccessToken(false);
        claim.setAddToIdToken(true);
        claim.setAddToUserInfo(true);

        provider.setId(9L);
        provider.setOrganization(organization);
        provider.setProviderAlias("google");

        assertThat(organization.getId()).isEqualTo(1L);
        assertThat(organization.getAlias()).isEqualTo("acme");
        assertThat(organization.getName()).isEqualTo("Acme");
        assertThat(organization.getDisplayName()).isEqualTo("Acme Corporation");
        assertThat(organization.getDescription()).isEqualTo("Description");
        assertThat(organization.isEnabled()).isFalse();
        assertThat(member.getId()).isEqualTo(2L);
        assertThat(member.getOrganization()).isSameAs(organization);
        assertThat(member.getUser()).isSameAs(user);
        assertThat(member.getRole()).isEqualTo("ADMIN");
        assertThat(member.getJoinedAt()).isEqualTo(joinedAt);
        assertThat(domain.getId()).isEqualTo(3L);
        assertThat(domain.getOrganization()).isSameAs(organization);
        assertThat(domain.getDomain()).isEqualTo("acme.example.com");
        assertThat(domain.isVerified()).isTrue();
        assertThat(domain.getVerificationToken()).isEqualTo("token");
        assertThat(domain.getVerifiedAt()).isEqualTo(verifiedAt);
        assertThat(invitation.getId()).isEqualTo(4L);
        assertThat(invitation.getOrganization()).isSameAs(organization);
        assertThat(invitation.getEmail()).isEqualTo("alice@example.com");
        assertThat(invitation.getRole()).isEqualTo("ADMIN");
        assertThat(invitation.getTokenHash()).isEqualTo("hash");
        assertThat(invitation.getExpiresAt()).isEqualTo(verifiedAt);
        assertThat(invitation.getAcceptedAt()).isEqualTo(joinedAt);
        assertThat(invitation.getRevokedAt()).isEqualTo(verifiedAt);
        assertThat(invitation.getCreatedAt()).isEqualTo(joinedAt);
        assertThat(group.getId()).isEqualTo(6L);
        assertThat(group.getOrganization()).isSameAs(organization);
        assertThat(group.getParent()).isSameAs(parent);
        assertThat(group.getName()).isEqualTo("engineering");
        assertThat(groupMember.getId()).isEqualTo(7L);
        assertThat(groupMember.getGroup()).isSameAs(group);
        assertThat(groupMember.getUser()).isSameAs(user);
        assertThat(groupMember.getJoinedAt()).isEqualTo(joinedAt);
        assertThat(claim.getId()).isEqualTo(8L);
        assertThat(claim.getOrganization()).isSameAs(organization);
        assertThat(claim.getClaimName()).isEqualTo("organization");
        assertThat(claim.getClaimValue()).isEqualTo("acme");
        assertThat(claim.isAddToAccessToken()).isFalse();
        assertThat(claim.isAddToIdToken()).isTrue();
        assertThat(claim.isAddToUserInfo()).isTrue();
        assertThat(provider.getId()).isEqualTo(9L);
        assertThat(provider.getOrganization()).isSameAs(organization);
        assertThat(provider.getProviderAlias()).isEqualTo("google");
    }
}
