package io.github.susimsek.springauthserversamples.web;

import io.github.susimsek.springauthserversamples.config.openapi.OpenApiConfig;
import io.github.susimsek.springauthserversamples.domain.UserAvatarEntity;
import io.github.susimsek.springauthserversamples.repository.UserAvatarRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@Tag(
        name = "Account",
        description = "Account Console profile, session, and application management.")
public class AvatarController {

    private final UserAvatarRepository userAvatarRepository;
    private final UserRepository userRepository;

    @GetMapping("/avatars/{id}")
    @Operation(
            summary = "Get public avatar",
            description =
                    "Returns a publicly addressable avatar when the supplied version matches the"
                            + " stored image.")
    @ApiResponse(
            responseCode = "200",
            description = "Avatar image returned.",
            content =
                    @Content(
                            mediaType = "image/*",
                            schema = @Schema(type = "string", format = "binary")))
    @ApiResponse(
            responseCode = "304",
            description = "Avatar has not changed since the supplied ETag.")
    @ApiResponse(
            responseCode = "404",
            description = "No avatar matches the identifier and version.")
    ResponseEntity<byte[]> avatar(
            @Parameter(
                            description = "Public avatar identifier.",
                            example = "user-avatar-123",
                            required = true)
                    @PathVariable
                    String id,
            @Parameter(
                            description = "Avatar version from the URL returned by the API.",
                            example = "1725438600000",
                            required = true)
                    @RequestParam("v")
                    long version,
            @org.springframework.web.bind.annotation.RequestHeader(
                            value = HttpHeaders.IF_NONE_MATCH,
                            required = false)
                    @Parameter(
                            description = "Previously returned ETag for conditional requests.",
                            example = "\"avatar-user-avatar-123-1725438600000\"")
                    String ifNoneMatch) {
        return userAvatarRepository
                .findByPublicId(id)
                .filter(avatar -> avatar.getUpdatedAt().toEpochMilli() == version)
                .map(
                        avatar ->
                                avatarResponse(
                                        id,
                                        ifNoneMatch,
                                        avatar,
                                        CacheControl.maxAge(Duration.ofDays(365))
                                                .cachePublic()
                                                .immutable()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping({"/account/avatar", "/api/account/avatar"})
    @Operation(
            summary = "Get current user avatar",
            description = "Returns the authenticated user's private avatar image.")
    @ApiResponse(
            responseCode = "200",
            description = "Avatar image returned.",
            content =
                    @Content(
                            mediaType = "image/*",
                            schema = @Schema(type = "string", format = "binary")))
    @ApiResponse(
            responseCode = "304",
            description = "Avatar has not changed since the supplied ETag.")
    @ApiResponse(responseCode = "404", description = "The authenticated user has no avatar.")
    @SecurityRequirement(name = OpenApiConfig.ACCOUNT_BEARER)
    ResponseEntity<byte[]> currentUserAvatar(
            Authentication authentication,
            @org.springframework.web.bind.annotation.RequestHeader(
                            value = HttpHeaders.IF_NONE_MATCH,
                            required = false)
                    @Parameter(
                            description = "Previously returned ETag for conditional requests.",
                            example = "\"avatar-user-avatar-123-1725438600000\"")
                    String ifNoneMatch) {
        return userRepository
                .findByUsername(authentication.getName())
                .flatMap(user -> userAvatarRepository.findById(user.getId()))
                .map(avatar -> avatarResponse(avatar.getPublicId(), ifNoneMatch, avatar))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private static ResponseEntity<byte[]> avatarResponse(
            String id, String ifNoneMatch, UserAvatarEntity avatar) {
        CacheControl cacheControl = CacheControl.noCache().cachePrivate();
        return avatarResponse(id, ifNoneMatch, avatar, cacheControl);
    }

    private static ResponseEntity<byte[]> avatarResponse(
            String id, String ifNoneMatch, UserAvatarEntity avatar, CacheControl cacheControl) {
        String etag = "\"avatar-" + id + "-" + avatar.getUpdatedAt().toEpochMilli() + "\"";
        if (ifNoneMatch != null && ifNoneMatch.contains(etag)) {
            return ResponseEntity.status(304).eTag(etag).cacheControl(cacheControl).build();
        }
        return ResponseEntity.ok()
                .eTag(etag)
                .cacheControl(cacheControl)
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(avatar.getContentType()))
                .body(avatar.getContent());
    }
}
