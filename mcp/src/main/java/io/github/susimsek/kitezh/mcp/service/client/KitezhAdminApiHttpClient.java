package io.github.susimsek.kitezh.mcp.service.client;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;

/** Typed HTTP interface for read-only Kitezh Administration API calls. */
@HttpExchange(accept = MediaType.APPLICATION_JSON_VALUE)
public interface KitezhAdminApiHttpClient {

    @GetExchange
    Map<String, Object> get(URI uri);

    @GetExchange
    List<Map<String, Object>> getList(URI uri);
}
