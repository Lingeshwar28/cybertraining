package com.cybersecurity.cybertraining.repository;

import com.cybersecurity.cybertraining.model.ModuleEnrollment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ModuleEnrollmentRepository extends JpaRepository<ModuleEnrollment, Long> {

    List<ModuleEnrollment> findByUserId(Long userId);

    List<ModuleEnrollment> findByModuleId(Long moduleId);

    Optional<ModuleEnrollment> findByUserIdAndModuleId(Long userId, Long moduleId);

    void deleteByModuleId(Long moduleId);
}
