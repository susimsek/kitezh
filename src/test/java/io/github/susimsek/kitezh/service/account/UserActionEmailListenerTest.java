package io.github.susimsek.kitezh.service.account;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import io.github.susimsek.kitezh.domain.UserAction;
import io.github.susimsek.kitezh.service.mail.MailService;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserActionEmailListenerTest {

    @Mock private MailService mailService;

    @Test
    void sendsVerificationEmailForEmailActions() {
        UserActionEmailListener listener = new UserActionEmailListener(mailService);

        listener.send(event(UserAction.VERIFY_EMAIL));
        listener.send(event(UserAction.UPDATE_EMAIL));

        verify(mailService, times(2))
                .sendEmailVerification("alice@example.com", "alice", Locale.ENGLISH, "/action");
    }

    @Test
    void sendsPasswordResetEmailForPasswordActions() {
        new UserActionEmailListener(mailService).send(event(UserAction.UPDATE_PASSWORD));

        verify(mailService)
                .sendPasswordReset("alice@example.com", "alice", Locale.ENGLISH, "/action");
    }

    private static UserActionEmailEvent event(UserAction action) {
        return new UserActionEmailEvent(
                action, "alice@example.com", "alice", Locale.ENGLISH, "/action");
    }
}
