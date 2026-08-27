from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from catalog.models import Session

from .factories import make_session, make_user


def session_payload(**overrides):
    base = {
        "title": "A session",
        "description": "d",
        "start_at": (timezone.now() + timedelta(days=2)).isoformat(),
        "duration_minutes": 60,
        "capacity": 5,
    }
    base.update(overrides)
    return base


class CreateAuthorizationTests(APITestCase):
    def setUp(self):
        self.normal_user = make_user("user@example.com", is_creator=False)
        self.creator = make_user("creator@example.com", is_creator=True)

    def test_anonymous_create_is_401(self):
        res = self.client.post(reverse("session-list"), session_payload(), format="json")
        self.assertEqual(res.status_code, 401)

    def test_normal_user_create_is_403(self):
        self.client.force_authenticate(self.normal_user)
        res = self.client.post(reverse("session-list"), session_payload(), format="json")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(Session.objects.count(), 0)

    def test_creator_create_is_201(self):
        self.client.force_authenticate(self.creator)
        res = self.client.post(reverse("session-list"), session_payload(), format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Session.objects.get().creator, self.creator)


class OwnershipAuthorizationTests(APITestCase):
    def setUp(self):
        self.creator_a = make_user("a@example.com", is_creator=True)
        self.creator_b = make_user("b@example.com", is_creator=True)
        self.normal_user = make_user("u@example.com", is_creator=False)
        self.session_a = make_session(self.creator_a, title="A's session")

    def test_creator_can_edit_their_own_session(self):
        self.client.force_authenticate(self.creator_a)
        res = self.client.patch(
            reverse("session-detail", args=[self.session_a.id]),
            {"title": "renamed"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.session_a.refresh_from_db()
        self.assertEqual(self.session_a.title, "renamed")

    def test_creator_cannot_edit_another_creators_session(self):
        self.client.force_authenticate(self.creator_b)
        res = self.client.patch(
            reverse("session-detail", args=[self.session_a.id]),
            {"title": "hijacked"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)
        self.session_a.refresh_from_db()
        self.assertEqual(self.session_a.title, "A's session")

    def test_creator_cannot_delete_another_creators_session(self):
        self.client.force_authenticate(self.creator_b)
        res = self.client.delete(reverse("session-detail", args=[self.session_a.id]))
        self.assertEqual(res.status_code, 403)
        self.assertTrue(Session.objects.filter(id=self.session_a.id).exists())

    def test_normal_user_cannot_edit_any_session(self):
        self.client.force_authenticate(self.normal_user)
        res = self.client.patch(
            reverse("session-detail", args=[self.session_a.id]),
            {"title": "nope"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_anyone_can_read_a_public_session(self):
        self.client.force_authenticate(self.creator_b)
        res = self.client.get(reverse("session-detail", args=[self.session_a.id]))
        self.assertEqual(res.status_code, 200)
