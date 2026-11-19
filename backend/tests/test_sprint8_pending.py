"""Sprint 8 cases written ahead of the features.

Each test is skipped until the feature exists, so the suite stays green.
Removing the skip should fail until the feature is actually built.
"""

import pytest


@pytest.mark.skip(reason="FR-BUD-05, FR-BUD-06: budget goals are not in this build, so going over a goal cannot be checked yet.")
def test_going_over_a_goal_is_never_blocked():
    pytest.fail("Budget goals are not implemented.")


@pytest.mark.skip(reason="FR-BUD-05: the mid-month edit rule is still open. Retroactive or forward only was not decided.")
def test_mid_month_goal_edit_rule_is_still_open():
    pytest.fail("The mid-month edit rule is not decided.")


@pytest.mark.skip(reason="FR-ANL-04: analysis range and empty state are not in this build.")
def test_analysis_range_and_empty_state():
    pytest.fail("Analysis is not implemented.")


@pytest.mark.skip(reason="FR-EXP-06: recurring bills are not in this build, so once-per-month cannot be checked yet.")
def test_recurring_bill_is_added_once_per_month():
    pytest.fail("Recurring bills are not implemented.")


@pytest.mark.skip(reason="FR-SOC-01, FR-SOC-02: activity and notifications are not in this build.")
def test_activity_and_notifications_stay_with_the_people_involved():
    pytest.fail("Activity and notifications are not implemented.")


@pytest.mark.skip(reason="FR-ADM-01, FR-ADM-03, FR-ADM-07: admin login, dashboard and blocked paths are not in this build.")
def test_every_blocked_admin_path():
    pytest.fail("Admin paths are not implemented.")
