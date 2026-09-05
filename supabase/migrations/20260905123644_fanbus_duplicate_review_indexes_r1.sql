-- Plärrdeifl Digitalplattform V4
-- R6-PROD-FANBUS-DUPLICATE-001
-- DEV-only follow-up: cover duplicate-review foreign keys reported by advisors.

create index fanbus_duplicate_reviews_registration_b_idx
  on app_private.fanbus_duplicate_reviews(registration_b_id);

create index fanbus_duplicate_reviews_decided_by_idx
  on app_private.fanbus_duplicate_reviews(decided_by);
