package io.github.susimsek.kitezh.dto.admin;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AdminOrganizationInvitationRequestDTOTest {

    @Test
    void defaultsMissingOrBlankRolesToMember() {
        assertThat(
                        new AdminOrganizationInvitationRequestDTO("user@example.test", null, null)
                                .roleValue())
                .isEqualTo("MEMBER");
        assertThat(
                        new AdminOrganizationInvitationRequestDTO("user@example.test", " \t", null)
                                .roleValue())
                .isEqualTo("MEMBER");
    }

    @Test
    void trimsAndNormalizesExplicitRoleValues() {
        assertThat(
                        new AdminOrganizationInvitationRequestDTO(
                                        "user@example.test", " owner ", null)
                                .roleValue())
                .isEqualTo("OWNER");
    }
}
