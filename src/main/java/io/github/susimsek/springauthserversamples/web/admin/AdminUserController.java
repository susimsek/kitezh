package io.github.susimsek.springauthserversamples.web.admin;

import io.github.susimsek.springauthserversamples.config.openapi.OpenApiConfig;
import io.github.susimsek.springauthserversamples.domain.UserAction;
import io.github.susimsek.springauthserversamples.dto.account.WebAuthnCredentialDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminAvatarDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminGroupDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminUserBulkOperationDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminUserBulkRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminUserDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminUserEnabledRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminUserRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminWebAuthnCredentialLabelRequestDTO;
import io.github.susimsek.springauthserversamples.dto.userprofile.UserProfileAttributesDTO;
import io.github.susimsek.springauthserversamples.dto.userprofile.UserProfileAttributesRequestDTO;
import io.github.susimsek.springauthserversamples.service.UserProfileService;
import io.github.susimsek.springauthserversamples.service.account.WebAuthnService;
import io.github.susimsek.springauthserversamples.service.admin.AdminAvatarService;
import io.github.susimsek.springauthserversamples.service.admin.AdminUserService;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import io.github.susimsek.springauthserversamples.web.ApiController;
import io.github.susimsek.springauthserversamples.web.admin.validation.CreateValidation;
import io.github.susimsek.springauthserversamples.web.admin.validation.PasswordChangeValidation;
import io.github.susimsek.springauthserversamples.web.admin.validation.UpdateValidation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@ApiController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@Tag(name = "Admin - Users", description = "User and credential administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminUserController {

    private final AdminUserService adminUserService;
    private final AdminAvatarService adminAvatarService;
    private final UserProfileService userProfileService;
    private final WebAuthnService webAuthnService;

    @GetMapping
    @Operation(
            summary = "Search users",
            description =
                    "Returns a paged user list with optional username and enabled-state filters.")
    @ApiResponse(responseCode = "200", description = "Paged users returned.")
    Page<AdminUserDTO> users(
            @Parameter(
                            description = "Optional username, email, or name search text.",
                            example = "user")
                    @RequestParam(defaultValue = "")
                    String q,
            @Parameter(description = "Filter by enabled state.", example = "true")
                    @RequestParam(required = false)
                    Boolean enabled,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return adminUserService.users(q, enabled, pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user", description = "Returns one user by internal identifier.")
    @ApiResponse(responseCode = "200", description = "User returned.")
    AdminUserDTO user(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            Authentication authentication) {
        return adminUserService.user(id, authentication.getName());
    }

    @GetMapping("/{id}/profile-attributes")
    @Operation(
            summary = "Read user profile attributes",
            description = "Returns configured profile fields and values for a user.")
    @ApiResponse(responseCode = "200", description = "Profile attributes returned.")
    UserProfileAttributesDTO profileAttributes(
            @PathVariable Long id, Authentication authentication) {
        adminUserService.requireManageableUser(id, authentication.getName());
        return userProfileService.attributes(id);
    }

    @PutMapping("/{id}/profile-attributes")
    @Operation(
            summary = "Update user profile attributes",
            description = "Validates and replaces configured profile values for a user.")
    @ApiResponse(responseCode = "200", description = "Profile attributes updated.")
    UserProfileAttributesDTO updateProfileAttributes(
            @PathVariable Long id,
            @Valid @RequestBody UserProfileAttributesRequestDTO request,
            Authentication authentication) {
        adminUserService.requireManageableUser(id, authentication.getName());
        return userProfileService.saveAttributes(
                id, request.attributes(), authentication.getName());
    }

    @GetMapping("/{id}/groups")
    @Operation(
            summary = "List a user's groups",
            description = "Returns groups to which the specified user belongs.")
    @ApiResponse(responseCode = "200", description = "Paged user groups returned.")
    Page<AdminGroupDTO> userGroups(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @Parameter(
                            description = "Optional group name or path search text.",
                            example = "finance")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable,
            Authentication authentication) {
        return adminUserService.groups(id, q, pageable, authentication.getName());
    }

    @GetMapping("/{id}/webauthn/credentials")
    @Operation(
            summary = "List user passkeys",
            description = "Returns registered passkeys for a user.")
    @ApiResponse(responseCode = "200", description = "Passkeys returned.")
    Page<WebAuthnCredentialDTO> webAuthnCredentials(
            @PathVariable Long id,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable,
            Authentication authentication) {
        var user = adminUserService.requireManageableUser(id, authentication.getName());
        return webAuthnService.credentials(user.getUsername(), pageable);
    }

    @GetMapping("/{id}/webauthn/credentials/{credentialId}")
    @Operation(
            summary = "Read user passkey data",
            description = "Returns registered passkey metadata.")
    @ApiResponse(responseCode = "200", description = "Passkey metadata returned.")
    WebAuthnCredentialDTO webAuthnCredential(
            @PathVariable Long id,
            @PathVariable String credentialId,
            Authentication authentication) {
        var user = adminUserService.requireManageableUser(id, authentication.getName());
        return webAuthnService.credential(user.getUsername(), credentialId);
    }

    @PutMapping("/{id}/webauthn/credentials/{credentialId}")
    @Operation(summary = "Rename user passkey", description = "Updates a registered passkey label.")
    @ApiResponse(responseCode = "204", description = "Passkey label updated.")
    ResponseEntity<Void> renameWebAuthnCredential(
            @PathVariable Long id,
            @PathVariable String credentialId,
            @Valid @RequestBody AdminWebAuthnCredentialLabelRequestDTO request,
            Authentication authentication) {
        String username =
                adminUserService.requireManageableUser(id, authentication.getName()).getUsername();
        webAuthnService.updateLabel(
                username, credentialId, request.label(), authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/webauthn/credentials/{credentialId}")
    @Operation(
            summary = "Delete user passkey",
            description = "Removes a registered passkey and invalidates the user's access.")
    @ApiResponse(responseCode = "204", description = "Passkey deleted.")
    ResponseEntity<Void> deleteWebAuthnCredential(
            @PathVariable Long id,
            @PathVariable String credentialId,
            Authentication authentication) {
        String username =
                adminUserService.requireManageableUser(id, authentication.getName()).getUsername();
        webAuthnService.deleteForAdministrator(username, credentialId, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    @Operation(
            summary = "Create user",
            description =
                    "Creates a user account with credentials, enabled state, and realm roles.")
    @ApiResponse(responseCode = "201", description = "User created and returned.")
    ResponseEntity<AdminUserDTO> createUser(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "New user account fields.",
                            required = true)
                    @Validated(CreateValidation.class)
                    @RequestBody
                    AdminUserRequestDTO request,
            Authentication authentication) {
        AdminUserDTO user =
                request.firstName() == null
                                && request.lastName() == null
                                && request.email() == null
                                && request.temporary() == null
                        ? adminUserService.createUser(
                                request.username(),
                                request.password(),
                                request.enabled() == null || request.enabled(),
                                request.roles(),
                                authentication.getName())
                        : adminUserService.createUser(
                                request.username(),
                                request.firstName(),
                                request.lastName(),
                                request.email(),
                                Boolean.TRUE.equals(request.emailVerified()),
                                request.password(),
                                Boolean.TRUE.equals(request.temporary()),
                                request.enabled() == null || request.enabled(),
                                request.roles(),
                                authentication.getName());
        return ResponseEntity.status(201).body(user);
    }

    @PostMapping("/bulk")
    @Operation(
            summary = "Apply a bulk user lifecycle operation",
            description =
                    "Enables, disables, or deletes up to 100 selected users atomically."
                            + " Every selected user must be manageable by the caller.")
    @ApiResponse(responseCode = "200", description = "Bulk user operation completed.")
    AdminUserBulkOperationDTO bulkOperate(
            @Valid @RequestBody AdminUserBulkRequestDTO request, Authentication authentication) {
        return adminUserService.bulkOperate(
                request.userIds(), request.action(), authentication.getName());
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Update user",
            description = "Updates editable user account fields and role assignments.")
    @ApiResponse(responseCode = "200", description = "Updated user returned.")
    AdminUserDTO updateUser(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Replacement user account fields.",
                            required = true)
                    @Validated(UpdateValidation.class)
                    @RequestBody
                    AdminUserRequestDTO request,
            Authentication authentication) {
        return adminUserService.updateUser(
                id,
                request.username(),
                request.firstName(),
                request.lastName(),
                request.email(),
                Boolean.TRUE.equals(request.emailVerified()),
                request.enabled() == null || request.enabled(),
                request.roles(),
                authentication.getName());
    }

    @PutMapping(path = "/{id}/avatar", consumes = "multipart/form-data")
    @Operation(
            summary = "Upload user avatar",
            description = "Stores a new avatar image for the specified user.")
    @ApiResponse(responseCode = "200", description = "Avatar URL returned.")
    AdminAvatarDTO updateAvatar(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @Parameter(description = "Image file to use as the avatar.", required = true)
                    @RequestParam("file")
                    MultipartFile file,
            Authentication authentication) {
        return adminAvatarService.updateAvatar(id, file, authentication.getName());
    }

    @DeleteMapping("/{id}/avatar")
    @Operation(
            summary = "Delete user avatar",
            description = "Removes the specified user's avatar image.")
    @ApiResponse(responseCode = "204", description = "Avatar deleted.")
    ResponseEntity<Void> deleteAvatar(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            Authentication authentication) {
        adminAvatarService.deleteAvatar(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/password")
    @Operation(
            summary = "Reset user password",
            description = "Replaces a user's password and invalidates affected access.")
    @ApiResponse(responseCode = "204", description = "Password reset completed.")
    ResponseEntity<Void> changePassword(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Replacement password.",
                            required = true)
                    @Validated(PasswordChangeValidation.class)
                    @RequestBody
                    AdminUserRequestDTO request,
            Authentication authentication) {
        if (request.temporary() == null) {
            adminUserService.changePassword(id, request.password(), authentication.getName());
        } else {
            adminUserService.changePassword(
                    id, request.password(), request.temporary(), authentication.getName());
        }
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/totp")
    @Operation(
            summary = "Reset user authenticator",
            description =
                    "Removes the user's current TOTP authenticator and invalidates affected"
                            + " access.")
    @ApiResponse(responseCode = "204", description = "Authenticator reset completed.")
    ResponseEntity<Void> resetTotp(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            Authentication authentication) {
        adminUserService.resetTotp(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/unlock")
    @Operation(
            summary = "Unlock user account",
            description = "Clears temporary and permanent login lock state.")
    @ApiResponse(responseCode = "204", description = "User account unlocked.")
    ResponseEntity<Void> unlockUser(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            Authentication authentication) {
        adminUserService.unlockUser(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @Operation(
            summary = "Delete user",
            description = "Deletes the specified user and invalidates related access.")
    @ApiResponse(responseCode = "204", description = "User deleted.")
    ResponseEntity<Void> deleteUser(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            Authentication authentication) {
        adminUserService.deleteUser(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/enabled")
    @Operation(
            summary = "Enable or disable user",
            description = "Changes whether the specified user may authenticate.")
    @ApiResponse(responseCode = "204", description = "User enabled state updated.")
    ResponseEntity<Void> setUserEnabled(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "New enabled state.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminUserEnabledRequestDTO request,
            Authentication authentication) {
        adminUserService.setUserEnabled(id, request.enabled(), authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/execute-actions-email")
    @Operation(
            summary = "Send an email for required user actions",
            description = "Sends an email for exactly one supported pending user action.")
    @ApiResponse(responseCode = "204", description = "Action email queued.")
    ResponseEntity<Void> executeActionsEmail(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @Parameter(description = "Optional token lifespan in seconds.", example = "3600")
                    @RequestParam(required = false)
                    Long lifespan,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description =
                                    "JSON array containing exactly one pending action, such as"
                                            + " `VERIFY_EMAIL`.",
                            required = true,
                            content =
                                    @io.swagger.v3.oas.annotations.media.Content(
                                            mediaType = "application/json",
                                            schema =
                                                    @io.swagger.v3.oas.annotations.media.Schema(
                                                            type = "array",
                                                            example = "[\"VERIFY_EMAIL\"]")))
                    @Valid
                    @NotNull(message = "{app.api.problem.violation.required}")
                    @Size(min = 1, max = 1, message = "{app.api.problem.violation.selection}")
                    @RequestBody
                    Set<@NotNull(message = "{app.api.problem.violation.required}") UserAction>
                            actions,
            Locale locale,
            Authentication authentication) {
        if (actions == null || actions.size() != 1) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_UNSUPPORTED, "Exactly one supported action is required");
        }
        adminUserService.executeActionsEmail(
                id, actions.iterator().next(), lifespan, locale, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/send-verify-email")
    @Operation(
            summary = "Send a verification email",
            description = "Sends an email containing a verification action link.")
    @ApiResponse(responseCode = "204", description = "Verification email queued.")
    ResponseEntity<Void> sendVerifyEmail(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @Parameter(description = "Optional token lifespan in seconds.", example = "3600")
                    @RequestParam(required = false)
                    Long lifespan,
            Locale locale,
            Authentication authentication) {
        adminUserService.executeActionsEmail(
                id, UserAction.VERIFY_EMAIL, lifespan, locale, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
