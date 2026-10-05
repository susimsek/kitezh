package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.dto.admin.AdminClientRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientScopeAssignmentRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminGroupRolesRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRequiredActionRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminUserBulkAction;
import io.github.susimsek.kitezh.dto.admin.AdminUserBulkRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminUserRequestDTO;
import io.github.susimsek.kitezh.web.admin.validation.CreateValidation;
import io.github.susimsek.kitezh.web.admin.validation.UpdateValidation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AdminRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsInvalidPublicClientConfiguration() {
        AdminClientRequestDTO request =
                new AdminClientRequestDTO(
                        "client",
                        "Client",
                        Set.of("none"),
                        Set.of("authorization_code"),
                        Set.of(),
                        Set.of(),
                        Set.of("openid"),
                        false,
                        false,
                        null,
                        null,
                        null);

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("redirectUris", "authorizationGrantTypes");
    }

    @Test
    void validatesRequiredFieldsWhenCreatingAUser() {
        AdminUserRequestDTO request = new AdminUserRequestDTO("", "short", null, Set.of());

        assertThat(validator.validate(request, CreateValidation.class))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("username", "password", "enabled", "roles");
    }

    @Test
    void permitsAnEmptyPasswordWhenUpdatingAUser() {
        AdminUserRequestDTO request =
                new AdminUserRequestDTO("user", "", true, Set.of("ROLE_USER"));

        assertThat(validator.validate(request, UpdateValidation.class)).isEmpty();
    }

    @Test
    void rejectsOversizedRequiredActionFields() {
        AdminRequiredActionRequestDTO request =
                new AdminRequiredActionRequestDTO(
                        "x".repeat(201), "x".repeat(1001), true, false, 1, 0, "x".repeat(4001));

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("displayName", "description", "configuration");
    }

    @Test
    void rejectsBlankRoleAndScopeAssignments() {
        AdminGroupRolesRequestDTO roles = new AdminGroupRolesRequestDTO(Set.of(""));
        AdminClientScopeAssignmentRequestDTO scopes =
                new AdminClientScopeAssignmentRequestDTO(Set.of(""), Set.of("profile"));

        assertThat(validator.validate(roles))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("roles[].<iterable element>");
        assertThat(validator.validate(scopes))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("defaultScopes[].<iterable element>");
    }

    @Test
    void validatesBulkUserLifecycleRequests() {
        AdminUserBulkRequestDTO request =
                new AdminUserBulkRequestDTO(List.of(), AdminUserBulkAction.DISABLE);
        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("userIds");

        AdminUserBulkRequestDTO oversized =
                new AdminUserBulkRequestDTO(
                        java.util.stream.LongStream.rangeClosed(1, 101).boxed().toList(),
                        AdminUserBulkAction.DELETE);
        assertThat(validator.validate(oversized))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("userIds");
    }
}
