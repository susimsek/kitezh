package io.github.susimsek.kitezh.service.account;

import io.github.susimsek.kitezh.domain.UserAction;
import java.util.Locale;

public record UserActionEmailEvent(
        UserAction action, String recipient, String username, Locale locale, String actionUrl) {}
