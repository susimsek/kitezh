package io.github.susimsek.kitezh.mcp.tool;

record McpPage(int page, int size) {

    static McpPage validated(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be zero or greater");
        }
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("size must be between 1 and 100");
        }
        return new McpPage(page, size);
    }
}
