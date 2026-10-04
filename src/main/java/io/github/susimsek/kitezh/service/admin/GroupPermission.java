package io.github.susimsek.kitezh.service.admin;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class GroupPermission {

    public static final String VIEW = "VIEW";
    public static final String MANAGE_MEMBERS = "MANAGE_MEMBERS";
    public static final String MANAGE_ROLES = "MANAGE_ROLES";
    public static final String MANAGE_GROUP = "MANAGE_GROUP";

    public static final java.util.Set<String> ALL =
            java.util.Set.of(VIEW, MANAGE_MEMBERS, MANAGE_ROLES, MANAGE_GROUP);
}
