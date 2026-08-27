from datetime import timedelta

from django.urls import reverse
from rest_framework.test import APITestCase

from catalog.models import Session
from catalog.tests.factories import make_session, make_user

from bookings.models import Booking


class BookingRuleTests(APITestCase):
    def setUp(self):
        self.creator = make_user("creator@example.com", is_creator=True)
        self.user = make_user("user@example.com")
        self.other = make_user("other@example.com")
        self.session = make_session(self.creator, capacity=1)

    def _book(self, user, session=None):
        self.client.force_authenticate(user)
        return self.client.post(
            reverse("session-book", args=[(session or self.session).id])
        )

    def test_booking_requires_authentication(self):
        res = self.client.post(reverse("session-book", args=[self.session.id]))
        self.assertEqual(res.status_code, 401)

    def test_successful_booking_increments_seats_taken(self):
        res = self._book(self.user)
        self.assertEqual(res.status_code, 201)
        self.session.refresh_from_db()
        self.assertEqual(self.session.seats_taken, 1)
        self.assertEqual(Booking.objects.filter(status="active").count(), 1)

    def test_cannot_book_the_same_session_twice(self):
        self._book(self.user)
        res = self._book(self.user)
        self.assertEqual(res.status_code, 409)
        self.session.refresh_from_db()
        self.assertEqual(self.session.seats_taken, 1)

    def test_cannot_book_a_full_session(self):
        self._book(self.user)  # fills capacity=1
        res = self._book(self.other)
        self.assertEqual(res.status_code, 409)
        self.assertIn("full", res.data["detail"].lower())

    def test_cannot_book_a_session_that_already_started(self):
        started = make_session(self.creator, starts_in=timedelta(minutes=-5))
        res = self._book(self.user, session=started)
        self.assertEqual(res.status_code, 409)
        self.assertIn("started", res.data["detail"].lower())

    def test_cannot_book_your_own_session(self):
        res = self._book(self.creator)
        self.assertEqual(res.status_code, 400)

    def test_can_rebook_after_cancelling(self):
        self._book(self.user)
        booking = Booking.objects.get()
        self.client.force_authenticate(self.user)
        cancel = self.client.post(reverse("booking-cancel", args=[booking.id]))
        self.assertEqual(cancel.status_code, 200)
        self.session.refresh_from_db()
        self.assertEqual(self.session.seats_taken, 0)

        res = self._book(self.user)
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Booking.objects.filter(status="active").count(), 1)


class BookingListTests(APITestCase):
    def setUp(self):
        self.creator = make_user("creator@example.com", is_creator=True)
        self.user = make_user("user@example.com")
        self.upcoming = make_session(self.creator, title="upcoming")
        self.started = make_session(self.creator, title="started",
                                    starts_in=timedelta(minutes=-1))
        Booking.objects.create(user=self.user, session=self.upcoming)
        Booking.objects.create(user=self.user, session=self.started)

    def test_only_my_bookings_are_returned(self):
        someone_else = make_user("x@example.com")
        Booking.objects.create(user=someone_else, session=self.upcoming)
        self.client.force_authenticate(self.user)
        res = self.client.get(reverse("booking-list"))
        self.assertEqual(len(res.data), 2)

    def test_active_filter_excludes_started_sessions(self):
        self.client.force_authenticate(self.user)
        res = self.client.get(reverse("booking-list") + "?status=active")
        titles = {b["session"]["title"] for b in res.data}
        self.assertEqual(titles, {"upcoming"})

    def test_past_filter_includes_started_sessions(self):
        self.client.force_authenticate(self.user)
        res = self.client.get(reverse("booking-list") + "?status=past")
        titles = {b["session"]["title"] for b in res.data}
        self.assertEqual(titles, {"started"})


class CancelAuthorizationTests(APITestCase):
    def setUp(self):
        self.creator = make_user("creator@example.com", is_creator=True)
        self.user = make_user("user@example.com")
        self.session = make_session(self.creator, capacity=5)
        self.booking = Booking.objects.create(user=self.user, session=self.session)

    def test_cannot_cancel_someone_elses_booking(self):
        stranger = make_user("stranger@example.com")
        self.client.force_authenticate(stranger)
        res = self.client.post(reverse("booking-cancel", args=[self.booking.id]))
        self.assertEqual(res.status_code, 404)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, "active")
