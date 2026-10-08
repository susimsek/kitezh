package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ConsoleClientsTest {

    @Test
    void includesDedicatedMobileClientsInTheirSecurityBoundaries() {
        assertThat(ConsoleClients.ALL)
                .contains(ConsoleClients.MOBILE_ADMIN, ConsoleClients.MOBILE_ACCOUNT)
                .doesNotHaveDuplicates();
        assertThat(ConsoleClients.ADMIN_CLIENTS)
                .containsExactlyInAnyOrder(
                        ConsoleClients.ADMIN,
                        ConsoleClients.DESKTOP_ADMIN,
                        ConsoleClients.MOBILE_ADMIN);
        assertThat(ConsoleClients.ACCOUNT_CLIENTS)
                .containsExactlyInAnyOrder(
                        ConsoleClients.ACCOUNT,
                        ConsoleClients.DESKTOP_ACCOUNT,
                        ConsoleClients.MOBILE_ACCOUNT);
        assertThat(ConsoleClients.ADMIN_CLIENTS)
                .doesNotContainAnyElementsOf(ConsoleClients.ACCOUNT_CLIENTS);
    }
}
