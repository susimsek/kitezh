package io.github.susimsek.kitezh.config.security;

import java.util.Set;

final class ConsoleClients {

    static final String ADMIN = "admin-console";
    static final String DESKTOP_ADMIN = "desktop-admin-console";
    static final String MOBILE_ADMIN = "mobile-admin-console";
    static final String ACCOUNT = "account-console";
    static final String DESKTOP_ACCOUNT = "desktop-account-console";
    static final String MOBILE_ACCOUNT = "mobile-account-console";
    static final Set<String> ALL =
            Set.of(ADMIN, DESKTOP_ADMIN, MOBILE_ADMIN, ACCOUNT, DESKTOP_ACCOUNT, MOBILE_ACCOUNT);
    static final Set<String> ADMIN_CLIENTS = Set.of(ADMIN, DESKTOP_ADMIN, MOBILE_ADMIN);
    static final Set<String> ACCOUNT_CLIENTS = Set.of(ACCOUNT, DESKTOP_ACCOUNT, MOBILE_ACCOUNT);

    private ConsoleClients() {}
}
