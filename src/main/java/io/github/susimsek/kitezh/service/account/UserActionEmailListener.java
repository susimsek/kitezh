package io.github.susimsek.kitezh.service.account;

import io.github.susimsek.kitezh.domain.UserAction;
import io.github.susimsek.kitezh.service.mail.MailService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
class UserActionEmailListener {

    private final MailService mailService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void send(UserActionEmailEvent event) {
        if (event.action() == UserAction.VERIFY_EMAIL
                || event.action() == UserAction.UPDATE_EMAIL) {
            mailService.sendEmailVerification(
                    event.recipient(), event.username(), event.locale(), event.actionUrl());
        } else {
            mailService.sendPasswordReset(
                    event.recipient(), event.username(), event.locale(), event.actionUrl());
        }
    }
}
