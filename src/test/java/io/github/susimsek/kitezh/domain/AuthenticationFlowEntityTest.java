package io.github.susimsek.kitezh.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AuthenticationFlowEntityTest {

    @Test
    void accessorsTopLevelAndEqualityWork() {
        AuthenticationFlowEntity flow = new AuthenticationFlowEntity();

        flow.setId(1L);
        flow.setAlias("browser");
        flow.setName("Browser");
        flow.setDescription("Browser login");
        flow.setFlowType(AuthenticationFlowType.BASIC);
        flow.setBuiltIn(true);
        flow.setRequirement(AuthenticationFlowRequirement.ALTERNATIVE);
        flow.setPriority(10);

        assertThat(flow.isTopLevel()).isTrue();
        AuthenticationFlowEntity parent = new AuthenticationFlowEntity();
        flow.setParentFlow(parent);
        assertThat(flow.isTopLevel()).isFalse();
        assertThat(flow.getAlias()).isEqualTo("browser");
        assertThat(flow.getName()).isEqualTo("Browser");
        assertThat(flow.getDescription()).isEqualTo("Browser login");
        assertThat(flow.getFlowType()).isEqualTo(AuthenticationFlowType.BASIC);
        assertThat(flow.isBuiltIn()).isTrue();
        assertThat(flow.getParentFlow()).isSameAs(parent);
        assertThat(flow.getRequirement()).isEqualTo(AuthenticationFlowRequirement.ALTERNATIVE);
        assertThat(flow.getPriority()).isEqualTo(10);

        AuthenticationFlowEntity same = new AuthenticationFlowEntity();
        same.setId(1L);
        AuthenticationFlowEntity different = new AuthenticationFlowEntity();
        different.setId(2L);
        AuthenticationFlowEntity withoutId = new AuthenticationFlowEntity();

        assertThat(flow)
                .isEqualTo(flow)
                .isEqualTo(same)
                .isNotEqualTo(different)
                .isNotEqualTo(withoutId)
                .isNotEqualTo(null)
                .isNotEqualTo("flow")
                .hasSameHashCodeAs(AuthenticationFlowEntity.class);
    }
}
