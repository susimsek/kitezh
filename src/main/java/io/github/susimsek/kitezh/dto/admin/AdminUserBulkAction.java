package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Bulk lifecycle operation to apply to selected user accounts.")
public enum AdminUserBulkAction {
    ENABLE,
    DISABLE,
    DELETE
}
