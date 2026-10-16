package io.github.susimsek.kitezh.web;

import io.github.susimsek.kitezh.dto.release.AppReleaseMetadataDTO;
import io.github.susimsek.kitezh.service.AppReleaseMetadataService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/public/app-release")
@RequiredArgsConstructor
@Tag(name = "Public - Application release", description = "Cached application release metadata.")
public class AppReleaseMetadataController {

    private final AppReleaseMetadataService appReleaseMetadataService;

    @GetMapping
    @Operation(
            summary = "Get the latest application release",
            description =
                    "Returns allowlisted, versioned application asset URLs from the cached GitHub"
                            + " release for desktop and mobile clients.")
    @ApiResponse(responseCode = "200", description = "Latest application release returned.")
    public AppReleaseMetadataDTO latest() {
        return appReleaseMetadataService.getLatestReleaseMetadata();
    }
}
