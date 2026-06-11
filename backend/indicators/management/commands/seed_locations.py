from django.core.management.base import BaseCommand
from indicators.models import Province, District


class Command(BaseCommand):
    help = 'Seeds all Rwanda provinces and districts including aggregate locations'

    def handle(self, *args, **options):
        provinces_data = [
            'Kigali City',
            'Southern Province',
            'Western Province',
            'Northern Province',
            'Eastern Province',
            'National',
        ]

        provinces = {}
        for p_name in provinces_data:
            prov, created = Province.objects.get_or_create(name=p_name)
            provinces[p_name] = prov
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created Province: "{p_name}"'))

        # Each list ends with the province-level aggregate entry (same name as province).
        # "National" contains only the country-level aggregate "Rwanda".
        districts_data = {
            'Kigali City':      ['Nyarugenge', 'Gasabo', 'Kicukiro', 'Kigali City'],
            'Southern Province':['Nyanza', 'Gisagara', 'Nyaruguru', 'Huye', 'Ruhango',
                                 'Nyamagabe', 'Kamonyi', 'Muhanga', 'Southern Province'],
            'Western Province': ['Karongi', 'Rutsiro', 'Rubavu', 'Nyabihu', 'Ngororero',
                                 'Rusizi', 'Nyamasheke', 'Western Province'],
            'Northern Province':['Rulindo', 'Gakenke', 'Musanze', 'Burera', 'Gicumbi',
                                 'Northern Province'],
            'Eastern Province': ['Rwamagana', 'Nyagatare', 'Gatsibo', 'Kayonza', 'Kirehe',
                                 'Ngoma', 'Bugesera', 'Eastern Province'],
            'National':         ['Rwanda'],
        }

        total_created = 0
        for prov_name, dist_list in districts_data.items():
            province = provinces[prov_name]
            for dist_name in dist_list:
                # Determine the level for this entry
                if prov_name == 'National':
                    level = District.NATIONAL
                elif dist_name == prov_name:
                    level = District.PROVINCE
                else:
                    level = District.DISTRICT

                _, created = District.objects.update_or_create(
                    name=dist_name,
                    province=province,
                    defaults={'level': level},
                )
                if created:
                    total_created += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'Created {level}: "{dist_name}" in {prov_name}')
                    )

        self.stdout.write(
            self.style.SUCCESS(f'Seeding complete. {total_created} new entries created.')
        )
