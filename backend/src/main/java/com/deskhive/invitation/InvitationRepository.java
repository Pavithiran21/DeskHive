package com.deskhive.invitation;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface InvitationRepository extends JpaRepository<Invitation, Long> {

    Optional<Invitation> findByTokenHash(String tokenHash);

    /** Newest first: the first one of a user is the one the People screen shows. */
    List<Invitation> findByUserIdInOrderByIdDesc(Collection<Long> userIds);

    /**
     * Marks the link used only if it is still unused, not revoked and not expired, in one UPDATE.
     * If the person double-clicks "Create account", only one request gets 1 back.
     */
    @Modifying
    @Transactional
    @Query("""
            update Invitation i set i.usedAt = :now
            where i.id = :id and i.usedAt is null and i.revokedAt is null and i.expiresAt > :now
            """)
    int markUsed(Long id, Instant now);

    /** A resend: every older link of the person stops working. */
    @Modifying
    @Transactional
    @Query("update Invitation i set i.revokedAt = :now where i.userId = :userId and i.usedAt is null and i.revokedAt is null")
    int revokeAllForUser(Long userId, Instant now);

    @Modifying
    @Transactional
    @Query("delete from Invitation i where i.userId = :userId")
    int deleteAllForUser(Long userId);
}
