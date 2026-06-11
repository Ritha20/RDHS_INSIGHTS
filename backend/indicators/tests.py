from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User

from indicators.models import Category, Province, District, Indicator, IndicatorValue
from indicators.tasks import resolve_district_by_name


class AdminAuthTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin', password='pass1234',
            is_staff=True, is_superuser=True,
        )
        self.client = Client()

    def test_login_page_loads(self):
        response = self.client.get(reverse('admin_login'))
        self.assertEqual(response.status_code, 200)

    def test_valid_admin_login_redirects_to_dashboard(self):
        response = self.client.post(
            reverse('admin_login'),
            {'username': 'admin', 'password': 'pass1234'},
        )
        self.assertRedirects(response, reverse('admin_dashboard'))

    def test_invalid_credentials_show_error(self):
        response = self.client.post(
            reverse('admin_login'),
            {'username': 'admin', 'password': 'wrong'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('error_message', response.context)

    def test_non_staff_login_denied(self):
        User.objects.create_user(username='plain', password='pass1234')
        response = self.client.post(
            reverse('admin_login'),
            {'username': 'plain', 'password': 'pass1234'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('error_message', response.context)

    def test_dashboard_requires_login(self):
        response = self.client.get(reverse('admin_dashboard'))
        self.assertRedirects(response, reverse('admin_login') + '?next=/')

    def test_authenticated_admin_accesses_dashboard(self):
        self.client.login(username='admin', password='pass1234')
        response = self.client.get(reverse('admin_dashboard'))
        self.assertEqual(response.status_code, 200)

    def test_root_url_redirects_to_dashboard(self):
        self.client.login(username='admin', password='pass1234')
        response = self.client.get('/')
        self.assertRedirects(response, reverse('admin_dashboard'))


class ResolveDistrictTests(TestCase):
    def setUp(self):
        self.province = Province.objects.create(name="Eastern Province")
        self.district = District.objects.create(name="Nyagatare", province=self.province)
        self.prov_district = District.objects.create(name="Eastern Province", province=self.province)
        self.national = District.objects.create(name="Rwanda", province=self.province)

    def test_exact_district_match(self):
        self.assertEqual(resolve_district_by_name("Nyagatare"), self.district)

    def test_alias_east_province(self):
        self.assertEqual(resolve_district_by_name("East Province"), self.prov_district)

    def test_alias_national(self):
        self.assertEqual(resolve_district_by_name("National"), self.national)
        self.assertEqual(resolve_district_by_name("Rwanda (National)"), self.national)

    def test_case_insensitive_and_whitespace(self):
        self.assertEqual(resolve_district_by_name("  nyagatare  "), self.district)

    def test_unknown_name_returns_none(self):
        self.assertIsNone(resolve_district_by_name("NowhereVille"))

    def test_none_input_returns_none(self):
        self.assertIsNone(resolve_district_by_name(None))
        self.assertIsNone(resolve_district_by_name(""))
