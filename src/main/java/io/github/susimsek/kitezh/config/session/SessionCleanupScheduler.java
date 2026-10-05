package io.github.susimsek.kitezh.config.session;

import io.github.susimsek.kitezh.session.JpaIndexedSessionRepository;
import java.util.concurrent.ScheduledFuture;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronTrigger;

final class SessionCleanupScheduler implements InitializingBean, DisposableBean {

    private final JpaIndexedSessionRepository sessionRepository;
    private final TaskScheduler taskScheduler;
    private final String cleanupCron;
    private ScheduledFuture<?> scheduledTask;

    SessionCleanupScheduler(
            JpaIndexedSessionRepository sessionRepository,
            TaskScheduler taskScheduler,
            String cleanupCron) {
        this.sessionRepository = sessionRepository;
        this.taskScheduler = taskScheduler;
        this.cleanupCron = cleanupCron;
    }

    @Override
    public void afterPropertiesSet() {
        if (!Scheduled.CRON_DISABLED.equals(cleanupCron)) {
            scheduledTask =
                    taskScheduler.schedule(
                            sessionRepository::cleanUpExpiredSessions,
                            new CronTrigger(cleanupCron));
        }
    }

    @Override
    public void destroy() {
        if (scheduledTask != null) {
            scheduledTask.cancel(false);
        }
    }
}
