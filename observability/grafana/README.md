# Production Grafana dashboard

`spring-boot-production.json` is a Grafana dashboard for the Spring Boot 4.x
application. It follows the same separation used by Keycloak: the application
publishes metrics, Prometheus collects them, and Grafana renders the dashboard.

## Import

1. Configure a Prometheus data source in Grafana.
2. Open **Dashboards > Import** and upload `spring-boot-production.json`.
3. Select the Prometheus data source when Grafana asks for it.
4. Choose the `job` and `instance` variables for the deployed service.

The dashboard expects the standard Micrometer Prometheus names emitted by Spring
Boot Actuator. Panels that use P95/P99 latency require request histograms to be
enabled in the production profile.

The SLO row follows the Keycloak troubleshooting dashboard pattern and shows
availability, responses below 250 ms, server-error rate, and request volume.
The latency SLO is intentionally based on the request histogram rather than an
average so it remains useful for tail latency.

The dashboard was checked against the live Spring Boot 4.1 registry. It covers
the production-relevant meters for HTTP server requests, JVM memory and thread
state, GC overhead, process and system resources, disk and file descriptors,
Hikari/JDBC pools, application cache hits, misses, evictions and size, Spring
Security authorizations, Spring Data repository calls, Logback events, and
Tomcat sessions. The remaining low-level meters are available from
`/actuator/prometheus` and can be inspected in Explore without adding a panel
for every JVM pool or connection timer.

The production profile publishes request histogram buckets at 250 ms, 1 s, and
5 s in addition to the aggregable percentiles used by the latency panels.

The dashboard cache row uses Spring Boot’s Micrometer cache meters. The
application pre-registers every Caffeine cache so `cache_gets_total`,
`cache_puts_total`, `cache_evictions_total`, `cache_size`, and eviction-weight
meters are available from startup. Hibernate statistics remain disabled because
they are high-cardinality diagnostics rather than the application cache signal
shown here.

## Prometheus scrape target

For a reachable deployment, scrape:

```yaml
scrape_configs:
  - job_name: spring-authorization-server
    metrics_path: /actuator/prometheus
    scheme: https
    static_configs:
      - targets:
          - spring-authorization-server-samples.onrender.com
```

Keep the metrics endpoint private or protected when the service is used outside
the demo environment. If Grafana Cloud OTLP metrics export is enabled, use either
that pipeline or Prometheus scraping as the canonical metrics path to avoid
seeing duplicate series.

## Alerts

`../prometheus/alerts.yml` contains baseline production rules for availability,
HTTP 5xx rate, JVM heap usage, and Hikari pool saturation. Load these rules into
Prometheus or translate them into Grafana-managed alert rules.
