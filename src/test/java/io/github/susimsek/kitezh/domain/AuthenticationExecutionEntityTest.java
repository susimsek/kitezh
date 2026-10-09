package io.github.susimsek.kitezh.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AuthenticationExecutionEntityTest {

    @Test
    void accessorsAndEqualityWork() {
        AuthenticationFlowEntity flow = new AuthenticationFlowEntity();
        AuthenticationExecutionEntity execution = new AuthenticationExecutionEntity();
        execution.setId(1L);
        execution.setFlow(flow);
        execution.setProviderId("otp-form");
        execution.setDisplayName("OTP");
        execution.setRequirement(AuthenticationFlowRequirement.REQUIRED);
        execution.setPriority(10);
        execution.setAuthenticatorReference("otp");
        execution.setConfiguration("{}");

        assertThat(execution.getFlow()).isSameAs(flow);
        assertThat(execution.getProviderId()).isEqualTo("otp-form");
        assertThat(execution.getDisplayName()).isEqualTo("OTP");
        assertThat(execution.getRequirement()).isEqualTo(AuthenticationFlowRequirement.REQUIRED);
        assertThat(execution.getPriority()).isEqualTo(10);
        assertThat(execution.getAuthenticatorReference()).isEqualTo("otp");
        assertThat(execution.getConfiguration()).isEqualTo("{}");

        AuthenticationExecutionEntity same = new AuthenticationExecutionEntity();
        same.setId(1L);
        AuthenticationExecutionEntity different = new AuthenticationExecutionEntity();
        different.setId(2L);
        AuthenticationExecutionEntity withoutId = new AuthenticationExecutionEntity();

        assertThat(execution)
                .isEqualTo(execution)
                .isEqualTo(same)
                .isNotEqualTo(different)
                .isNotEqualTo(withoutId)
                .isNotEqualTo(null)
                .isNotEqualTo("execution")
                .hasSameHashCodeAs(AuthenticationExecutionEntity.class);
    }
}
