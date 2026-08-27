from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_add_timestamps"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="brand",
            options={"ordering": ["name"]},
        ),
    ]
