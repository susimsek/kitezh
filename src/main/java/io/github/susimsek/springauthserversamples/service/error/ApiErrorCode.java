package io.github.susimsek.springauthserversamples.service.error;

/** Stable business error codes shared by all application REST APIs. */
public enum ApiErrorCode {
    INVALID_REQUEST("invalid_request", "The request contains an invalid value."),
    VALIDATION_FAILED("validation_failed", "The request contains invalid data."),
    RESOURCE_NOT_FOUND("resource_not_found", "The requested resource was not found."),
    CONFLICT("conflict", "The request conflicts with the current resource state."),
    FORBIDDEN("forbidden", "You are not allowed to perform this operation."),
    INTERNAL_ERROR("internal_error", "An unexpected error occurred."),
    RATE_LIMIT_EXCEEDED("rate_limit_exceeded", "Too many requests. Please try again later."),
    INVALID_CURRENT_PASSWORD("invalid_current_password", "Current password is invalid."),
    REAUTHENTICATION_REQUIRED(
            "reauthentication_required",
            "Re-authentication is required before changing the email address."),
    INVALID_TOTP_CODE("invalid_totp_code", "Authenticator code is invalid."),
    INVALID_RECOVERY_CODE(
            "invalid_recovery_code", "Recovery code is invalid or has already been used."),
    INVALID_PASSWORD(
            "invalid_password",
            "Password must be at least 12 characters and include uppercase, lowercase, a number,"
                    + " and a symbol."),
    PASSWORD_UNCHANGED("password_unchanged", "New password must be different."),
    PASSWORD_MISMATCH("password_mismatch", "Passwords do not match."),
    CAPTCHA_FAILED("captcha_failed", "CAPTCHA verification failed."),
    SESSION_FORBIDDEN("session_forbidden", "You cannot manage another user's session."),
    AVATAR_EMPTY("avatar_empty", "An avatar file is required."),
    AVATAR_TOO_LARGE("avatar_too_large", "Avatar must not exceed 2 MiB."),
    AVATAR_INVALID_TYPE("avatar_invalid_type", "Avatar must be a JPEG or PNG image."),
    AVATAR_UNREADABLE("avatar_unreadable", "Avatar could not be read."),
    AVATAR_DIMENSIONS("avatar_dimensions", "Avatar dimensions must not exceed 4 megapixels."),
    CLIENT_DUPLICATE_CLIENT_ID("client_duplicate_client_id", "Client ID is already registered."),
    CLIENT_INVALID_AUTHENTICATION_METHODS(
            "client_invalid_authentication_methods",
            "The client authentication method configuration is invalid."),
    CLIENT_INVALID_CLIENT_ID("client_invalid_client_id", "Client ID is required."),
    CLIENT_INVALID_CLIENT_NAME("client_invalid_client_name", "Client name is required."),
    CLIENT_INVALID_GRANT_TYPES(
            "client_invalid_grant_types", "The client grant type configuration is invalid."),
    CLIENT_INVALID_PKCE("client_invalid_pkce", "PKCE requires the authorization code grant."),
    CLIENT_INVALID_REQUEST("client_invalid_request", "Request body is required."),
    CLIENT_INVALID_SCOPES("client_invalid_scopes", "At least one client scope is required."),
    CLIENT_INVALID_TTL("client_invalid_ttl", "Token lifetime must be positive."),
    CLIENT_INVALID_URI("client_invalid_uri", "The URI is invalid."),
    CLIENT_PKCE_REQUIRED(
            "client_pkce_required", "PKCE is required for public authorization code clients."),
    CLIENT_PROTECTED("client_protected", "This client cannot be changed."),
    CLIENT_REDIRECT_URI_REQUIRED(
            "client_redirect_uri_required",
            "At least one redirect URI is required for the authorization code grant."),
    CLIENT_SCOPE_ASSIGNED("client_scope_assigned", "Assigned client scopes cannot be deleted."),
    CLIENT_SCOPE_PROTECTED("client_scope_protected", "Built-in client scopes cannot be changed."),
    CLIENT_SCOPE_ASSIGNMENT_OVERLAP(
            "client_scope_assignment_overlap", "A scope cannot be both default and optional."),
    CLIENT_SCOPE_DUPLICATE("client_scope_duplicate", "Client scope already exists."),
    CLIENT_SCOPE_INVALID_NAME("client_scope_invalid_name", "Client scope name is invalid."),
    CLIENT_SCOPE_UNKNOWN("client_scope_unknown", "One or more client scopes do not exist."),
    CLIENT_SCOPE_ROLE_UNKNOWN(
            "client_scope_role_unknown", "One or more client scope roles do not exist."),
    CLIENT_SECRET_REQUIRED(
            "client_secret_required",
            "A client secret must be generated before enabling secret authentication."),
    CLIENT_MAPPER_DUPLICATE_NAME(
            "client_mapper_duplicate_name", "Client mapper name is already registered."),
    CLIENT_MAPPER_SOURCE_REQUIRED(
            "client_mapper_source_required", "A source is required for this mapper type."),
    CLIENT_MAPPER_TARGET_REQUIRED(
            "client_mapper_target_required", "Select at least one token target."),
    CLIENT_ROLE_DUPLICATE_NAME("client_role_duplicate_name", "Client role already exists."),
    CLIENT_ROLE_INVALID_NAME("client_role_invalid_name", "Client role name is invalid."),
    CLIENT_ROLE_ASSIGNED(
            "client_role_assigned", "Client role is assigned to one or more users or groups."),
    CLIENT_ROLE_COMPOSITE_CYCLE(
            "client_role_composite_cycle",
            "A client role composite relationship would create a cycle."),
    GROUP_DUPLICATE_NAME("group_duplicate_name", "Group name is already registered."),
    GROUP_HAS_CHILDREN(
            "group_has_children", "Move or delete child groups before deleting this group."),
    GROUP_INVALID_PARENT("group_invalid_parent", "The group parent is invalid."),
    GROUP_INVALID_NAME("group_invalid_name", "Group name is required."),
    GROUP_INVALID_ROLES("group_invalid_roles", "One or more roles are invalid."),
    GROUP_INVALID_ATTRIBUTES("group_invalid_attributes", "Group attributes are invalid."),
    GROUP_INVALID_PERMISSION("group_invalid_permission", "The group permission is invalid."),
    KEY_ROTATION_FAILED("key_rotation_failed", "The signing key could not be rotated."),
    LAST_ADMIN_PROTECTED("last_admin_protected", "The last administrator must be retained."),
    ROLE_ASSIGNED("role_assigned", "This role is assigned to one or more users."),
    ROLE_DUPLICATE_NAME("role_duplicate_name", "Role is already registered."),
    ROLE_ESCALATION("role_escalation", "You can only assign roles you already have."),
    ROLE_INVALID_NAME("role_invalid_name", "Role names must use uppercase ROLE_ format."),
    ROLE_PROTECTED("role_protected", "This default role cannot be removed."),
    ROLE_COMPOSITE_CYCLE(
            "role_composite_cycle", "A role composite relationship would create a cycle."),
    SEARCH_TOO_LONG("search_too_long", "Search query must not exceed 100 characters."),
    USER_DUPLICATE_USERNAME("user_duplicate_username", "Username is already registered."),
    USER_DUPLICATE_EMAIL("user_duplicate_email", "Email is already registered."),
    ACTION_EMAIL_REQUIRED("action_email_required", "The user must have an email address."),
    ACTION_EMAIL_UNAVAILABLE("action_email_unavailable", "Email delivery is not configured."),
    ACTION_EMAIL_COOLDOWN("action_email_cooldown", "Please wait before sending another email."),
    EMAIL_TEST_FAILED("email_test_failed", "The SMTP connection test failed."),
    ACTION_TOKEN_INVALID("action_token_invalid", "The action token is invalid."),
    ACTION_TOKEN_EXPIRED("action_token_expired", "The action token has expired."),
    ACTION_TOKEN_USED("action_token_used", "The action token has already been used."),
    ACTION_UNSUPPORTED("action_unsupported", "The requested user action is not supported."),
    USER_INVALID_PASSWORD(
            "user_invalid_password",
            "Password must be at least 12 characters and include uppercase, lowercase, a number,"
                    + " and a symbol."),
    USER_INVALID_ROLES("user_invalid_roles", "One or more roles are invalid."),
    USER_INVALID_USERNAME("user_invalid_username", "Username is required."),
    USER_PROTECTED("user_protected", "This user cannot be changed by the current administrator."),
    USER_PROFILE_INVALID_NAME(
            "user_profile_invalid_name", "The profile attribute name is invalid."),
    USER_PROFILE_DUPLICATE_NAME(
            "user_profile_duplicate_name", "The profile attribute already exists."),
    USER_PROFILE_INVALID_DEFINITION(
            "user_profile_invalid_definition", "The profile attribute definition is invalid."),
    USER_PROFILE_INVALID_VALUE(
            "user_profile_invalid_value", "The profile attribute value is invalid."),
    USER_PROFILE_REQUIRED("user_profile_required", "The profile attribute is required."),
    LDAP_READ_ONLY("ldap_read_only", "The LDAP profile is read-only."),
    LDAP_WRITE_FAILED("ldap_write_failed", "The LDAP profile could not be updated.");

    private final String value;
    private final String defaultMessage;

    ApiErrorCode(String value, String defaultMessage) {
        this.value = value;
        this.defaultMessage = defaultMessage;
    }

    public String value() {
        return value;
    }

    public String defaultMessage() {
        return defaultMessage;
    }

    public String messageCode() {
        return "app.api.problem." + value;
    }

    public String type() {
        return "urn:problem:" + value;
    }
}
