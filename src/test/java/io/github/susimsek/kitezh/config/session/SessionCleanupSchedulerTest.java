package io.github.susimsek.kitezh.config.session;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import io.github.susimsek.kitezh.session.JpaIndexedSessionRepository;
import java.util.concurrent.ScheduledFuture;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.Trigger;
import org.springframework.scheduling.annotation.Scheduled;

class SessionCleanupSchedulerTest {

    @Test
    void afterPropertiesSetSchedulesCleanupWhenCronIsEnabled() {
        JpaIndexedSessionRepository repository = mock(JpaIndexedSessionRepository.class);
        TaskScheduler taskScheduler = mock(TaskScheduler.class);
        ScheduledFuture<?> scheduledFuture = mock(ScheduledFuture.class);
        doReturn(scheduledFuture)
                .when(taskScheduler)
                .schedule(any(Runnable.class), any(Trigger.class));
        SessionCleanupScheduler scheduler =
                new SessionCleanupScheduler(repository, taskScheduler, "0 * * * * *");

        scheduler.afterPropertiesSet();

        ArgumentCaptor<Runnable> runnableCaptor = ArgumentCaptor.forClass(Runnable.class);
        verify(taskScheduler).schedule(runnableCaptor.capture(), any(Trigger.class));
        runnableCaptor.getValue().run();
        verify(repository).cleanUpExpiredSessions();
    }

    @Test
    void afterPropertiesSetSkipsSchedulingWhenCronIsDisabled() {
        JpaIndexedSessionRepository repository = mock(JpaIndexedSessionRepository.class);
        TaskScheduler taskScheduler = mock(TaskScheduler.class);
        SessionCleanupScheduler scheduler =
                new SessionCleanupScheduler(repository, taskScheduler, Scheduled.CRON_DISABLED);

        scheduler.afterPropertiesSet();

        verify(taskScheduler, never()).schedule(any(Runnable.class), any(Trigger.class));
        verify(repository, never()).cleanUpExpiredSessions();
    }

    @Test
    void destroyCancelsScheduledTaskWhenPresent() {
        JpaIndexedSessionRepository repository = mock(JpaIndexedSessionRepository.class);
        TaskScheduler taskScheduler = mock(TaskScheduler.class);
        ScheduledFuture<?> scheduledFuture = mock(ScheduledFuture.class);
        doReturn(scheduledFuture)
                .when(taskScheduler)
                .schedule(any(Runnable.class), any(Trigger.class));
        SessionCleanupScheduler scheduler =
                new SessionCleanupScheduler(repository, taskScheduler, "0 * * * * *");
        scheduler.afterPropertiesSet();

        scheduler.destroy();

        verify(scheduledFuture).cancel(false);
    }

    @Test
    void destroyDoesNothingWhenTaskWasNeverScheduled() {
        JpaIndexedSessionRepository repository = mock(JpaIndexedSessionRepository.class);
        TaskScheduler taskScheduler = mock(TaskScheduler.class);
        SessionCleanupScheduler scheduler =
                new SessionCleanupScheduler(repository, taskScheduler, Scheduled.CRON_DISABLED);

        scheduler.destroy();

        verifyNoInteractions(repository, taskScheduler);
    }
}
