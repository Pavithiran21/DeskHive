package com.deskhive.office;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

public interface FloorRepository extends JpaRepository<Floor, Long> {

    List<Floor> findByOfficeIdOrderByNameAsc(Long officeId);

    /** The floors of many offices in one query (the office list). */
    List<Floor> findByOfficeIdInOrderByNameAsc(Collection<Long> officeIds);

    List<Floor> findByIdIn(Collection<Long> ids);

    boolean existsByOfficeIdAndName(Long officeId, String name);

    boolean existsByOfficeIdAndNameAndIdNot(Long officeId, String name, Long id);

    long countByOfficeId(Long officeId);

    /** Locked while spaces are added or the floor is deleted, so the two can't pass each other. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from Floor f where f.id = :id")
    Optional<Floor> lockById(Long id);
}
