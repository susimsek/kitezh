package io.github.susimsek.kitezh;

import static org.mockito.Mockito.mockStatic;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.boot.SpringApplication;

class KitezhApplicationMainTest {

    @Test
    void mainDelegatesToSpringApplication() {
        try (MockedStatic<SpringApplication> mocked = mockStatic(SpringApplication.class)) {
            KitezhApplication.main(new String[] {"--test"});

            mocked.verify(
                    () -> SpringApplication.run(KitezhApplication.class, new String[] {"--test"}));
        }
    }
}
