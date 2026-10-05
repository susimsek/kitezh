package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.CibaPolicyEntity;
import io.github.susimsek.kitezh.dto.admin.AdminCibaPolicyRequestDTO;
import io.github.susimsek.kitezh.repository.CibaPolicyRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class CibaPolicyServiceTest {

    private final CibaPolicyRepository repository = mock(CibaPolicyRepository.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final CibaPolicyService service = new CibaPolicyService(repository, auditEventService);

    @Test
    void returnsAndUpdatesPolicy() {
        CibaPolicyEntity entity = policy();
        when(repository.findById(1L)).thenReturn(Optional.of(entity));

        assertThat(service.get().deliveryMode()).isEqualTo("all");

        AdminCibaPolicyRequestDTO update =
                new AdminCibaPolicyRequestDTO(120, 10, "PUSH", "REQUIRED", true, true, " loa2 ");
        assertThat(service.update(update))
                .satisfies(
                        value -> {
                            assertThat(value.requestLifespanSeconds()).isEqualTo(120);
                            assertThat(value.pollingIntervalSeconds()).isEqualTo(10);
                            assertThat(value.deliveryMode()).isEqualTo("push");
                            assertThat(value.userVerification()).isEqualTo("required");
                            assertThat(value.mfaRequired()).isTrue();
                            assertThat(value.stepUpRequired()).isTrue();
                            assertThat(value.stepUpAcr()).isEqualTo("loa2");
                        });
        verify(repository).save(entity);
        verify(auditEventService).record("ciba.policy.updated", "ciba-policy", "default");
    }

    private static CibaPolicyEntity policy() {
        CibaPolicyEntity entity = new CibaPolicyEntity();
        entity.setId(1L);
        entity.setRequestLifespanSeconds(300);
        entity.setPollingIntervalSeconds(5);
        entity.setDeliveryMode("all");
        entity.setUserVerification("preferred");
        return entity;
    }
}
