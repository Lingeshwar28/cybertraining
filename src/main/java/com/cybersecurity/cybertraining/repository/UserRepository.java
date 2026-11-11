package com.cybersecurity.cybertraining.repository;

import com.cybersecurity.cybertraining.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByRole(String role);

    List<User> findByRoleOrderByFullNameAsc(String role);

    Optional<User> findFirstByRoleOrderByIdAsc(String role);
}
