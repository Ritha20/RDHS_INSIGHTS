from django.apps import AppConfig


class IndicatorsConfig(AppConfig):
    name = 'indicators'

    def ready(self):
        from django.db.backends.signals import connection_created

        def _set_sqlite_wal(sender, connection, **kwargs):
            if connection.vendor == 'sqlite':
                cursor = connection.cursor()
                # WAL mode: readers never block writers; writers never block readers.
                # This dramatically reduces "database is locked" under concurrent threads.
                cursor.execute('PRAGMA journal_mode=WAL;')
                cursor.execute('PRAGMA synchronous=NORMAL;')
                cursor.execute('PRAGMA busy_timeout=30000;')  # 30 s at the SQLite level

        connection_created.connect(_set_sqlite_wal)
