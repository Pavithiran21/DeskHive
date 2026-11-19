package com.deskhive.office;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface OfficeRepository extends JpaRepository<Office, Long> {

    List<Office> findAllByOrderByNameAsc();

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, Long id);

    /**
     * Locked while deleting, so a floor can't be added to an office that is being deleted. Plain
     * SELECT ... FOR UPDATE: Hibernate's lock mode would add "OF <alias>", which TiDB refuses.
     */
    @Query(value = "select * from offices where id = :id for update", nativeQuery = true)
    java.util.Optional<Office> lockById(Long id);
}
