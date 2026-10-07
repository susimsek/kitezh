package io.github.susimsek.kitezh.dto.account;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class OrganizationDomainVerificationRequestDTOTest {

    @Test
    void storesVerificationToken() {
        assertThat(new OrganizationDomainVerificationRequestDTO("token").token())
                .isEqualTo("token");
    }
}
