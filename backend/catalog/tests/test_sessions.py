from datetime import timedelta

from django.db import IntegrityError, transaction
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from catalog.models import Session

from .factories import make_session, make_user


class SessionListingTests(APITestCase):
    def setUp(self):
        self.creator = make_user("creator@example.com", is_creator=True)
        self.other = make_user("other@example.com")
        self.public = make_session(self.creator, title="Public one")
        self.private = make_session(self.creator, title="Private one", is_public=False)

    def test_public_sessions_are_listed_without_authentication(self):
        res = self.client.get(reverse("session-list"))
        self.assertEqual(res.status_code, 200)
        titles = {s["title"] for s in res.data}
        self.assertIn("Public one", titles)
        self.assertNotIn("Private one", titles)

    def test_private_session_is_hidden_from_other_users(self):
        self.client.force_authenticate(self.other)
        res = self.client.get(reverse("session-list"))
        titles = {s["title"] for s in res.data}
        self.assertNotIn("Private one", titles)

    def test_creator_sees_their_own_private_session(self):
        self.client.force_authenticate(self.creator)
        res = self.client.get(reverse("session-list") + "?mine=1")
        titles = {s["title"] for s in res.data}
        self.assertEqual(titles, {"Public one", "Private one"})

    def test_detail_includes_derived_fields(self):
        res = self.client.get(reverse("session-detail", args=[self.public.id]))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["remaining_seats"], self.public.capacity)
        self.assertFalse(res.data["has_started"])
        self.assertIn("end_at", res.data)


class SessionCreateValidationTests(APITestCase):
    def setUp(self):
        self.user = make_user("u@example.com")
        self.payload = {
            "title": "New session",
            "description": "d",
            "start_at": (timezone.now() + timedelta(days=2)).isoformat(),
            "duration_minutes": 60,
            "capacity": 5,
        }

    def test_create_requires_authentication(self):
        res = self.client.post(reverse("session-list"), self.payload, format="json")
        self.assertEqual(res.status_code, 401)

    def test_create_rejects_zero_capacity(self):
        self.client.force_authenticate(self.user)
        res = self.client.post(
            reverse("session-list"), {**self.payload, "capacity": 0}, format="json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("capacity", res.data)

    def test_create_rejects_start_in_the_past(self):
        self.client.force_authenticate(self.user)
        res = self.client.post(
            reverse("session-list"),
            {**self.payload, "start_at": (timezone.now() - timedelta(hours=1)).isoformat()},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("start_at", res.data)

    def test_created_session_belongs_to_the_caller_and_seats_taken_is_zero(self):
        self.client.force_authenticate(self.user)
        res = self.client.post(reverse("session-list"), self.payload, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["seats_taken"], 0)
        self.assertEqual(res.data["creator"]["id"], self.user.id)


class SessionDatabaseConstraintTests(APITestCase):
    """The DB is the last line of defence even if serializer validation is bypassed."""

    def setUp(self):
        self.creator = make_user("c@example.com", is_creator=True)

    def test_db_rejects_capacity_zero(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Session.objects.create(
                    title="bad", creator=self.creator,
                    start_at=timezone.now() + timedelta(days=1),
                    duration_minutes=60, capacity=0,
                )

    def test_db_rejects_seats_taken_above_capacity(self):
        s = make_session(self.creator, capacity=2)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                s.seats_taken = 3
                s.save(update_fields=["seats_taken"])
