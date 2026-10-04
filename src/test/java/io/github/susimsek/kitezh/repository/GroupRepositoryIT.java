package io.github.susimsek.kitezh.repository;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.IntegrationTest;
import io.github.susimsek.kitezh.domain.GroupEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

@IntegrationTest
@Transactional
class GroupRepositoryIT {

    @Autowired private GroupRepository groupRepository;

    @Autowired private UserRepository userRepository;

    @Test
    void sortsAUsersGroupsByGroupName() {
        UserEntity user = userRepository.findByUsername("admin").orElseThrow();
        GroupEntity second = groupRepository.save(group("Zulu group"));
        GroupEntity first = groupRepository.save(group("Alpha group"));
        user.getGroups().clear();
        user.getGroups().add(second);
        user.getGroups().add(first);
        userRepository.saveAndFlush(user);

        var result =
                groupRepository.findByUserIdAndNameContainingIgnoreCase(
                        user.getId(), "", PageRequest.of(0, 20, Sort.by("name")));

        assertThat(result.getContent())
                .extracting(GroupEntity::getName)
                .containsExactly("Alpha group", "Zulu group");
    }

    private static GroupEntity group(String name) {
        GroupEntity group = new GroupEntity();
        group.setName(name);
        return group;
    }
}
