package io.github.susimsek.springauthserversamples.dto.oauth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CibaBackchannelAuthenticationResponseDTOTest {

    @Test
    void supportsOptionalIntervalAndUserCode() {
        CibaBackchannelAuthenticationResponseDTO response =
                new CibaBackchannelAuthenticationResponseDTO("request", 300, 5, "USER-123");

        assertThat(response.authReqId()).isEqualTo("request");
        assertThat(response.expiresIn()).isEqualTo(300);
        assertThat(response.interval()).isEqualTo(5);
        assertThat(response.userCode()).isEqualTo("USER-123");
    }

    @Test
    void defaultsUserCodeToNullForLegacyConstructor() {
        CibaBackchannelAuthenticationResponseDTO response =
                new CibaBackchannelAuthenticationResponseDTO("request", 300, null);

        assertThat(response.authReqId()).isEqualTo("request");
        assertThat(response.expiresIn()).isEqualTo(300);
        assertThat(response.interval()).isNull();
        assertThat(response.userCode()).isNull();
    }
}
