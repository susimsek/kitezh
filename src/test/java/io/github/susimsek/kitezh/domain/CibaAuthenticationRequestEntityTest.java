package io.github.susimsek.kitezh.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class CibaAuthenticationRequestEntityTest {

    @Test
    void accessorsAndEqualityWork() {
        Instant now = Instant.EPOCH;
        CibaAuthenticationRequestEntity entity =
                new CibaAuthenticationRequestEntity(
                        "request", "client", "admin", "openid", "Approve", now, now, 5);
        entity.setId(1L);
        entity.setStatus(CibaAuthenticationRequestStatus.APPROVED);
        entity.setLastPolledAt(now);
        entity.setApprovedAt(now);
        entity.setDeniedAt(now);
        entity.setConsumedAt(now);

        CibaAuthenticationRequestEntity same = new CibaAuthenticationRequestEntity();
        same.setId(1L);
        CibaAuthenticationRequestEntity different = new CibaAuthenticationRequestEntity();
        different.setId(2L);

        assertThat(entity.getAuthReqId()).isEqualTo("request");
        assertThat(entity.getRegisteredClientId()).isEqualTo("client");
        assertThat(entity.getPrincipalName()).isEqualTo("admin");
        assertThat(entity.getAuthorizedScopes()).isEqualTo("openid");
        assertThat(entity.getBindingMessage()).isEqualTo("Approve");
        assertThat(entity.getStatus()).isEqualTo(CibaAuthenticationRequestStatus.APPROVED);
        assertThat(entity.getCreatedAt()).isEqualTo(now);
        assertThat(entity.getExpiresAt()).isEqualTo(now);
        assertThat(entity.getIntervalSeconds()).isEqualTo(5);
        assertThat(entity.getLastPolledAt()).isEqualTo(now);
        assertThat(entity.getApprovedAt()).isEqualTo(now);
        assertThat(entity.getDeniedAt()).isEqualTo(now);
        assertThat(entity.getConsumedAt()).isEqualTo(now);
        assertThat(entity)
                .isEqualTo(entity)
                .isEqualTo(same)
                .isNotEqualTo(different)
                .isNotEqualTo(null)
                .isNotEqualTo("request")
                .hasSameHashCodeAs(CibaAuthenticationRequestEntity.class);
    }
}
