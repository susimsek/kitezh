package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

/** Native platform that initiated a direct mobile login attempt. */
@Schema(description = "Supported native login platform.")
public enum MobileLoginPlatform {
    ANDROID,
    IOS
}
