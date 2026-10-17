package io.github.susimsek.kitezh.service.account;

import io.github.susimsek.kitezh.repository.PersonalAccessTokenSeedRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class PersonalAccessTokenSeedRunner implements ApplicationRunner {

    private final PersonalAccessTokenSeedRepository seedRepository;
    private final PersonalAccessTokenService personalAccessTokenService;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedRepository
                .findAllForUpdate()
                .forEach(
                        seed ->
                                personalAccessTokenService.ensureSeedToken(
                                        seed.getSeedKey(),
                                        seed.getUsername(),
                                        seed.getName(),
                                        seed.getDescription(),
                                        seed.getExpiration()));
    }
}
