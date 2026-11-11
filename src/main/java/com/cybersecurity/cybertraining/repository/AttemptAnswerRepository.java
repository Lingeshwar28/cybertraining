package com.cybersecurity.cybertraining.repository;

import com.cybersecurity.cybertraining.model.AttemptAnswer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AttemptAnswerRepository extends JpaRepository<AttemptAnswer, Long> {

    List<AttemptAnswer> findByAttemptId(Long attemptId);

    boolean existsByAttemptIdAndQuestionId(Long attemptId, Long questionId);

    boolean existsByQuestionId(Long questionId);
}
