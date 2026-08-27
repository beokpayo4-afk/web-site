from django.db import migrations


def backfill_status(apps, schema_editor):
    Product = apps.get_model("catalog", "Product")
    Product.objects.filter(is_active=False).update(status="UNPUBLISHED")
    Product.objects.filter(is_active=True).update(status="PUBLISHED")


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0005_product_status_optional_brand"),
    ]

    operations = [
        migrations.RunPython(backfill_status, noop),
    ]
