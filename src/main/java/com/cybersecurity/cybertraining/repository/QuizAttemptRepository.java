package com.cybersecurity.cybertraining.repository;

import com.cybersecurity.cybertraining.model.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {

    List<QuizAttempt> findByUserIdOrderByStartedAtDesc(Long userId);

    boolean existsByModuleId(Long moduleId);

    List<QuizAttempt> findByModuleIdAndCompletedAtIsNotNull(Long moduleId);
}
