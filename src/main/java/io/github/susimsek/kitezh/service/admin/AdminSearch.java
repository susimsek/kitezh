package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;

final class AdminSearch {

    private static final int MAX_QUERY_LENGTH = 100;

    private AdminSearch() {}

    static String normalize(String query) {
        String normalized = query == null ? "" : query.strip();
        if (normalized.length() > MAX_QUERY_LENGTH) {
            throw ApiException.badRequest(
                    ApiErrorCode.SEARCH_TOO_LONG, "Search query must not exceed 100 characters");
        }
        return normalized;
    }
}
