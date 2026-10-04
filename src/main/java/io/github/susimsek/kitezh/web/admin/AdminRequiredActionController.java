package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminRequiredActionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRequiredActionRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminUserRequiredActionDTO;
import io.github.susimsek.kitezh.service.admin.AdminUserService;
import io.github.susimsek.kitezh.service.requiredaction.RequiredActionService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/admin/required-actions")
@RequiredArgsConstructor
@Tag(name = "Admin - Required actions", description = "Required action policy administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminRequiredActionController {

    private final RequiredActionService requiredActionService;
    private final AdminUserService adminUserService;

    @GetMapping
    @Operation(
            summary = "List required action policies",
            description = "Returns all configured required-action policies.")
    @ApiResponse(responseCode = "200", description = "Required-action policies returned.")
    List<AdminRequiredActionDTO> definitions() {
        return requiredActionService.definitions();
    }

    @GetMapping("/users/{id}")
    @Operation(summary = "List a user's required actions")
    @ApiResponse(responseCode = "200", description = "User required-action assignments returned.")
    List<AdminUserRequiredActionDTO> userActions(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            Authentication authentication) {
        adminUserService.requireManageableUser(id, authentication.getName());
        return requiredActionService.userActions(id);
    }

    @PutMapping("/{key}")
    @Operation(
            summary = "Update a required action policy",
            description = "Updates the configuration and version of one required-action policy.")
    @ApiResponse(responseCode = "200", description = "Required-action policy updated.")
    AdminRequiredActionDTO update(
            @Parameter(
                            description = "Stable required-action key.",
                            example = "UPDATE_PROFILE",
                            required = true)
                    @PathVariable
                    String key,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Replacement required-action policy.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminRequiredActionRequestDTO request) {
        return requiredActionService.updateDefinition(key, request);
    }

    @PostMapping("/users/{id}/{key}")
    @Operation(
            summary = "Assign a required action to a user",
            description = "Assigns a required-action policy to a manageable user account.")
    @ApiResponse(responseCode = "204", description = "Required action assigned.")
    ResponseEntity<Void> assign(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @Parameter(
                            description = "Stable required-action key.",
                            example = "UPDATE_PROFILE",
                            required = true)
                    @PathVariable
                    String key,
            Authentication authentication) {
        adminUserService.requireManageableUser(id, authentication.getName());
        requiredActionService.assign(id, key, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{id}/{key}")
    @Operation(
            summary = "Remove a required action from a user",
            description = "Removes a required-action assignment from a user account.")
    @ApiResponse(responseCode = "204", description = "Required action removed.")
    ResponseEntity<Void> unassign(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @Parameter(
                            description = "Stable required-action key.",
                            example = "UPDATE_PROFILE",
                            required = true)
                    @PathVariable
                    String key,
            Authentication authentication) {
        adminUserService.requireManageableUser(id, authentication.getName());
        requiredActionService.unassign(id, key);
        return ResponseEntity.noContent().build();
    }
}
