from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="wishlist",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
