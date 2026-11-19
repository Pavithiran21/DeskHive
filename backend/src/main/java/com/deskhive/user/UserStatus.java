package com.deskhive.user;

/**
 * ACTIVE can log in. INVITED has an invitation but no password yet. REMOVED was removed by an Admin
 * (final in the MVP). DELETED deleted their own account: the row is anonymised and hidden from People,
 * and their past bookings show "Former employee".
 */
public enum UserStatus {
    ACTIVE,
    INVITED,
    REMOVED,
    DELETED
}
