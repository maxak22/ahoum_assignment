from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import User

VERIFIED_CLAIMS = {
    "iss": "https://accounts.google.com",
    "sub": "google-sub-123",
    "email": "New.Person@Example.com",
    "email_verified": True,
    "name": "New Person",
    "picture": "http://example.com/p.png",
}


@override_settings(GOOGLE_OAUTH_CLIENT_ID="test-client-id.apps.googleusercontent.com")
class AuthTests(APITestCase):
    # ---- 401: authentication errors -------------------------------------
    def test_me_requires_authentication(self):
        res = self.client.get(reverse("auth-me"))
        self.assertEqual(res.status_code, 401)

    def test_me_rejects_a_garbage_bearer_token(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not.a.jwt")
        res = self.client.get(reverse("auth-me"))
        self.assertEqual(res.status_code, 401)

    # ---- 400: Google token / OAuth failures ---------------------------
    @patch("accounts.services.google_id_token.verify_oauth2_token")
    def test_login_rejects_unverified_email_and_creates_no_user(self, mock_verify):
        mock_verify.return_value = {**VERIFIED_CLAIMS, "email_verified": False}
        res = self.client.post(reverse("auth-google"), {"id_token": "x"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    @patch("accounts.services.google_id_token.verify_oauth2_token")
    def test_login_rejects_an_invalid_google_token(self, mock_verify):
        mock_verify.side_effect = ValueError("bad signature")
        res = self.client.post(reverse("auth-google"), {"id_token": "x"}, format="json")
        self.assertEqual(res.status_code, 400)

    # ---- happy path + self-serve creator toggle -----------------------
    @patch("accounts.services.google_id_token.verify_oauth2_token")
    def test_login_creates_user_and_issues_tokens(self, mock_verify):
        mock_verify.return_value = VERIFIED_CLAIMS
        res = self.client.post(reverse("auth-google"), {"id_token": "x"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)
        user = User.objects.get()
        self.assertEqual(user.email, "new.person@example.com")  # normalised
        self.assertEqual(user.google_sub, "google-sub-123")
        self.assertFalse(user.is_creator)
        self.assertEqual(res.data["user"]["role"], "user")

    @patch("accounts.services.google_id_token.verify_oauth2_token")
    def test_second_login_reuses_the_same_account(self, mock_verify):
        mock_verify.return_value = VERIFIED_CLAIMS
        self.client.post(reverse("auth-google"), {"id_token": "x"}, format="json")
        self.client.post(reverse("auth-google"), {"id_token": "x"}, format="json")
        self.assertEqual(User.objects.count(), 1)

    @patch("accounts.services.google_id_token.verify_oauth2_token")
    def test_user_can_become_creator_via_me(self, mock_verify):
        mock_verify.return_value = VERIFIED_CLAIMS
        login = self.client.post(reverse("auth-google"), {"id_token": "x"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        res = self.client.patch(reverse("auth-me"), {"is_creator": True}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["role"], "creator")
        self.assertTrue(User.objects.get().is_creator)

    def test_dev_login_works_when_debug_is_on(self):
        with override_settings(DEBUG=True):
            res = self.client.post(
                reverse("auth-dev-login"),
                {"email": "reviewer@example.com", "is_creator": True},
                format="json",
            )
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        self.assertTrue(res.data["user"]["is_creator"])

    def test_dev_login_is_404_when_debug_is_off(self):
        with override_settings(DEBUG=False):
            res = self.client.post(
                reverse("auth-dev-login"), {"email": "x@example.com"}, format="json"
            )
        self.assertEqual(res.status_code, 404)
        self.assertEqual(User.objects.count(), 0)

    @patch("accounts.services.google_id_token.verify_oauth2_token")
    def test_me_cannot_change_email_or_role_directly(self, mock_verify):
        mock_verify.return_value = VERIFIED_CLAIMS
        login = self.client.post(reverse("auth-google"), {"id_token": "x"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        res = self.client.patch(
            reverse("auth-me"),
            {"email": "hacker@evil.com", "role": "creator"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        user = User.objects.get()
        self.assertEqual(user.email, "new.person@example.com")  # unchanged
        self.assertFalse(user.is_creator)  # role is read-only, ignored
