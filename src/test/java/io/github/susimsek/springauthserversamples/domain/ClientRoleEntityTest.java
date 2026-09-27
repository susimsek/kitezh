package io.github.susimsek.springauthserversamples.domain;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.springauthserversamples.domain.HibernateProxySupport.ProxyClientRoleEntity;
import org.junit.jupiter.api.Test;

class ClientRoleEntityTest {

    @Test
    void accessorsAndEqualityWork() {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("orders-client");
        ClientRoleEntity role = new ClientRoleEntity(client, "orders.read", "Read orders");
        role.setId(12L);

        ClientRoleEntity same = new ClientRoleEntity();
        same.setId(12L);
        ClientRoleEntity different = new ClientRoleEntity();
        different.setId(13L);
        ClientRoleEntity withoutId = new ClientRoleEntity();

        assertThat(role.getClient()).isSameAs(client);
        assertThat(role.getName()).isEqualTo("orders.read");
        assertThat(role.getDescription()).isEqualTo("Read orders");
        assertThat(role.getUsers()).isEmpty();
        assertThat(role.getGroups()).isEmpty();
        assertThat(role)
                .isEqualTo(role)
                .isEqualTo(same)
                .isNotEqualTo(different)
                .isNotEqualTo(withoutId)
                .isNotEqualTo(null)
                .isNotEqualTo("clientRole")
                .hasSameHashCodeAs(ClientRoleEntity.class);
    }

    @Test
    void equalitySupportsHibernateProxy() {
        ClientRoleEntity role = new ClientRoleEntity();
        role.setId(12L);
        ProxyClientRoleEntity proxy = new ProxyClientRoleEntity(ClientRoleEntity.class);
        proxy.setId(12L);

        assertThat(role).isEqualTo(proxy);
        assertThat(proxy).isEqualTo(role).hasSameHashCodeAs(ClientRoleEntity.class);
    }
}
