package io.github.susimsek.kitezh.mcp;

import io.github.susimsek.kitezh.mcp.config.ApplicationProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(ApplicationProperties.class)
public class KitezhMcpServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(KitezhMcpServerApplication.class, args);
    }
}
