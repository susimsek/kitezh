package io.github.susimsek.kitezh.web;

import io.github.susimsek.kitezh.dto.desktop.DesktopReleaseDTO;
import io.github.susimsek.kitezh.service.DesktopReleaseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/public/desktop-release")
@RequiredArgsConstructor
@Tag(name = "Public - Desktop release", description = "Cached desktop release metadata.")
public class DesktopReleaseController {

    private final DesktopReleaseService desktopReleaseService;

    @GetMapping
    @Operation(
            summary = "Get the latest desktop release",
            description =
                    "Returns allowlisted, versioned desktop asset URLs from the cached GitHub"
                            + " release.")
    @ApiResponse(responseCode = "200", description = "Latest desktop release returned.")
    public DesktopReleaseDTO latest() {
        return desktopReleaseService.getLatestRelease();
    }
}
