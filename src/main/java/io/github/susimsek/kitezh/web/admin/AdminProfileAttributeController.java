package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.userprofile.UserProfileAttributeDefinitionDTO;
import io.github.susimsek.kitezh.service.UserProfileService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/profile-attributes")
@RequiredArgsConstructor
@Tag(name = "Admin - Profile fields", description = "Enabled user profile field definitions.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminProfileAttributeController {

    private final UserProfileService userProfileService;

    @GetMapping
    @Operation(summary = "List enabled profile attribute definitions")
    @ApiResponse(
            responseCode = "200",
            description = "Enabled profile definitions returned.",
            content =
                    @Content(
                            schema =
                                    @Schema(
                                            implementation =
                                                    UserProfileAttributeDefinitionDTO.class)))
    List<UserProfileAttributeDefinitionDTO> definitions() {
        return userProfileService.definitions(true);
    }
}
