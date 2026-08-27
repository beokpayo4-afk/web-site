from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("engagement", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="contactmessage",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
