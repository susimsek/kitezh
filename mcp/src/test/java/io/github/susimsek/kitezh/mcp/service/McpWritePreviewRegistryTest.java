package io.github.susimsek.kitezh.mcp.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class McpWritePreviewRegistryTest {

    @Test
    void createsSingleUsePreviewBoundToCallerAndAction() {
        McpWritePreviewRegistry registry = new McpWritePreviewRegistry(Clock.systemUTC());

        McpWritePreviewRegistry.Preview preview =
                registry.create("admin", "disable-user", "14", "true", "false");

        assertThat(preview.token()).isNotBlank();
        assertThat(preview.expiresAt()).isAfter(Instant.now());
        assertThatThrownBy(() -> registry.consume(preview.token(), "other", "disable-user"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> registry.consume(preview.token(), "admin", "other-action"))
                .isInstanceOf(IllegalArgumentException.class);

        McpWritePreviewRegistry.Preview consumed =
                registry.consume(preview.token(), "admin", "disable-user");

        assertThat(consumed.target()).isEqualTo("14");
        assertThat(consumed.expectedState()).isEqualTo("true");
        assertThat(consumed.newState()).isEqualTo("false");
        assertThatThrownBy(() -> registry.consume(preview.token(), "admin", "disable-user"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void expiresOldPreviewsAndRemovesThemBeforeAddingAnother() {
        MutableClock clock = new MutableClock(Instant.parse("2026-10-18T10:00:00Z"));
        McpWritePreviewRegistry registry = new McpWritePreviewRegistry(clock);
        McpWritePreviewRegistry.Preview preview =
                registry.create("admin", "disable-user", "14", "true", "false");

        clock.advanceSeconds(301);

        assertThatThrownBy(() -> registry.consume(preview.token(), "admin", "disable-user"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(registry.create("admin", "disable-user", "15", "true", "false").token())
                .isNotBlank();
    }

    @Test
    void rejectsPreviewCapacityWhenAllEntriesAreUnexpired() {
        McpWritePreviewRegistry registry =
                new McpWritePreviewRegistry(
                        new MutableClock(Instant.parse("2026-10-18T10:00:00Z")));
        for (int index = 0; index < 2_048; index++) {
            registry.create("admin", "disable-user", Integer.toString(index), "true", "false");
        }

        assertThatThrownBy(
                        () -> registry.create("admin", "disable-user", "overflow", "true", "false"))
                .isInstanceOf(IllegalStateException.class);
    }

    private static final class MutableClock extends Clock {

        private final AtomicReference<Instant> current;

        private MutableClock(Instant initial) {
            current = new AtomicReference<>(initial);
        }

        void advanceSeconds(long seconds) {
            current.updateAndGet(instant -> instant.plusSeconds(seconds));
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return current.get();
        }
    }
}
