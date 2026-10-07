package io.github.susimsek.kitezh.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ProtocolMapperTypesTest {

    @Test
    void canonicalizesLegacyClientRoleType() {
        assertThat(ProtocolMapperTypes.canonicalize(" USER-CLIENT-ROLE "))
                .isEqualTo(ProtocolMapperTypes.CLIENT_ROLE);
    }
}
