from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0006_backfill_product_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="productimage",
            name="image_url",
            field=models.URLField(blank=True, max_length=1000),
        ),
        migrations.AlterField(
            model_name="productimage",
            name="image",
            field=models.ImageField(blank=True, upload_to="products/"),
        ),
    ]
