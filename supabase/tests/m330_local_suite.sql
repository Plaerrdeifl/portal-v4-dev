\set ON_ERROR_STOP on
\set M330_OUTER_TRANSACTION 1

begin;
\i /tmp/20260818194500_add_fanbus_trip_cancellation_m330_r1.sql
\i /tmp/20260818194600_add_fanbus_change_notifications_m330_r1.sql
\i /tmp/m330_fanbus_cancellation.sql
rollback;
