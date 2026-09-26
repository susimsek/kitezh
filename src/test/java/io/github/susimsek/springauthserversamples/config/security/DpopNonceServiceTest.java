package io.github.susimsek.springauthserversamples.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class DpopNonceServiceTest {

    @Test
    void issuesAndConsumesSingleUseNonceWhenRequired() {
        DpopNonceService service =
                new DpopNonceService(new ApplicationProperties.DPoP(true, Duration.ofMinutes(1)));

        String nonce = service.issue("DPoP access-token");

        assertThat(service.consume("DPoP access-token", nonce)).isTrue();
        assertThat(service.consume("DPoP access-token", nonce)).isFalse();
    }

    @Test
    void ignoresNonceWhenPolicyIsDisabled() {
        DpopNonceService service = new DpopNonceService(new ApplicationProperties.DPoP());

        String nonce = service.issue("DPoP access-token");

        assertThat(service.consume("DPoP access-token", nonce)).isFalse();
    }
}
