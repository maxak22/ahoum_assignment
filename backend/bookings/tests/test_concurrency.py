"""
The race-condition test.

WHY `TransactionTestCase` AND NOT `TestCase`
-------------------------------------------
`TestCase` wraps each test in a single transaction and rolls it back at the end.
That breaks this test two ways:
  1. the worker threads open their own DB connections, which cannot see rows
     created inside the main thread's still-open transaction;
  2. nothing is ever committed, so `SELECT ... FOR UPDATE` has no committed
     state to lock against and the behaviour under test never actually happens.
`TransactionTestCase` issues real COMMITs and truncates tables between tests, so
the threads see each other's work exactly like production.

WHY POSTGRESQL
--------------
`select_for_update()` needs real row-level locking. SQLite locks the whole
database with coarse granularity and ignores `FOR UPDATE`, so the test would be
meaningless there. The compose test DB is PostgreSQL.

WHY THIS EXPOSES A NAIVE IMPLEMENTATION
--------------------------------------
`test_a_naive_check_then_create_oversells` swaps in an unlocked
"if seats_taken < capacity: create()" version and shows BOTH concurrent
requests succeed -> the session is oversold. Same threads, same barrier, same
assertions: the only thing that changes is the locking. That's the proof the
test has teeth and that our implementation is what makes it pass.
"""

import threading
from datetime import timedelta
from unittest import mock

from django.db import connections
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from bookings import views
from bookings.models import Booking
from bookings.services import SessionFull
from catalog.models import Session

POSTGRES_ONLY = "row-level locking behaviour requires PostgreSQL"


class BookingConcurrencyTest(TransactionTestCase):
    def _make_session(self, capacity):
        creator = User.objects.create(
            username="race_creator", email="race_creator@example.com",
            is_creator=True, google_sub="race-creator",
        )
        return Session.objects.create(
            title="Race session", creator=creator,
            start_at=timezone.now() + timedelta(days=1),
            duration_minutes=60, capacity=capacity,
        )

    def _make_users(self, n):
        return [
            User.objects.create(
                username=f"racer{i}", email=f"racer{i}@example.com",
                google_sub=f"racer-{i}",
            )
            for i in range(n)
        ]

    def _fire_concurrent_bookings(self, session, users):
        """Every thread blocks on the barrier, then all POST at the same instant."""
        barrier = threading.Barrier(len(users))
        status_codes = {}

        def worker(idx, user):
            client = APIClient()
            client.force_authenticate(user)
            try:
                barrier.wait(timeout=10)
                resp = client.post(reverse("session-book", args=[session.id]))
                status_codes[idx] = resp.status_code
            finally:
                connections.close_all()  # this thread owns its own DB connection

        threads = [
            threading.Thread(target=worker, args=(i, u)) for i, u in enumerate(users)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=15)

        return status_codes

    # ---- the scenario from the brief -----------------------------------
    def test_two_concurrent_requests_for_the_last_seat(self):
        if connections["default"].vendor != "postgresql":
            self.skipTest(POSTGRES_ONLY)

        session = self._make_session(capacity=1)
        users = self._make_users(2)

        codes = self._fire_concurrent_bookings(session, users)

        self.assertEqual(sorted(codes.values()), [201, 409])
        self.assertEqual(
            Booking.objects.filter(session=session, status="active").count(), 1
        )
        session.refresh_from_db()
        self.assertEqual(session.seats_taken, 1)

    # ---- stronger: many racers, capacity 3 -----------------------------
    def test_many_concurrent_requests_never_oversell(self):
        if connections["default"].vendor != "postgresql":
            self.skipTest(POSTGRES_ONLY)

        session = self._make_session(capacity=3)
        users = self._make_users(12)

        codes = self._fire_concurrent_bookings(session, users)

        self.assertEqual(sum(c == 201 for c in codes.values()), 3)
        self.assertEqual(sum(c == 409 for c in codes.values()), 9)
        self.assertEqual(
            Booking.objects.filter(session=session, status="active").count(), 3
        )
        session.refresh_from_db()
        self.assertEqual(session.seats_taken, 3)

    # ---- proof the test can detect overselling -------------------------
    def test_a_naive_check_then_create_oversells(self):
        if connections["default"].vendor != "postgresql":
            self.skipTest(POSTGRES_ONLY)

        def naive_book(user, session_id):
            # No select_for_update, no atomic critical section, and the counter
            # is updated with a Python-side value so the CHECK constraint can't
            # save it either. This is the implementation the brief forbids.
            import time

            s = Session.objects.get(pk=session_id)
            if s.seats_taken >= s.capacity:
                raise SessionFull()
            time.sleep(0.15)  # widen the race window so the test is deterministic
            booking = Booking.objects.create(user=user, session=s, status="active")
            Session.objects.filter(pk=s.pk).update(seats_taken=s.seats_taken + 1)
            return booking

        session = self._make_session(capacity=1)
        users = self._make_users(2)

        with mock.patch.object(views, "book_session", naive_book):
            codes = self._fire_concurrent_bookings(session, users)

        # The naive version lets BOTH succeed -> oversold.
        self.assertEqual(sorted(codes.values()), [201, 201])
        self.assertGreater(
            Booking.objects.filter(session=session, status="active").count(),
            session.capacity,
        )
