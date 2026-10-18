package io.github.susimsek.kitezh.mcp.service.client;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.DeleteExchange;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;
import org.springframework.web.service.annotation.PutExchange;

/** Typed HTTP interface for Kitezh Administration API calls. */
@HttpExchange(accept = MediaType.APPLICATION_JSON_VALUE)
public interface KitezhAdminApiHttpClient {

    @GetExchange
    Map<String, Object> get(URI uri);

    @GetExchange
    List<Map<String, Object>> getList(URI uri);

    @PutExchange(contentType = MediaType.APPLICATION_JSON_VALUE)
    void put(URI uri, @RequestBody Map<String, ?> body);

    @PostExchange(contentType = MediaType.APPLICATION_JSON_VALUE)
    void post(URI uri, @RequestBody Map<String, ?> body);

    @DeleteExchange
    void delete(URI uri);
}
