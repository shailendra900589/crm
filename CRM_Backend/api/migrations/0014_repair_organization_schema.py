"""
Repair helper if 0013 left the DB in a mixed state.
Fully idempotent: never fails if tables/columns/indexes already exist.
"""

from django.db import migrations


def repair_and_seed(apps, schema_editor):
    from django.utils import timezone

    now = timezone.now()
    conn = schema_editor.connection
    with conn.cursor() as cursor:

        def exec_ignore(sql, params=None):
            try:
                cursor.execute(sql, params or [])
            except Exception:
                conn.rollback()
                # Re-open savepoint-friendly path: Django wraps migrations in a
                # transaction; after rollback we must not abort the whole migrate.
                # Prefer exception-safe DO blocks below instead.
                raise

        # Prefer DO blocks that swallow duplicate_object / duplicate_table.
        cursor.execute(
            """
            DO $$ BEGIN
              CREATE TABLE IF NOT EXISTS api_organization (
                id bigserial PRIMARY KEY,
                name varchar(200) NOT NULL,
                slug varchar(50) NOT NULL UNIQUE,
                email varchar(254) NOT NULL,
                phone varchar(20) NOT NULL DEFAULT '',
                city varchar(100) NOT NULL DEFAULT '',
                status varchar(20) NOT NULL DEFAULT 'pending',
                plan_label varchar(120) NOT NULL DEFAULT 'Trial',
                trial_ends_at timestamptz NULL,
                payment_notes text NOT NULL DEFAULT '',
                hrms_connected boolean NOT NULL DEFAULT false,
                hrms_company_id varchar(64) NOT NULL DEFAULT '',
                hrms_api_base_url varchar(200) NOT NULL DEFAULT 'https://hrms.trackbook.co',
                admin_name varchar(120) NOT NULL DEFAULT '',
                is_public boolean NOT NULL DEFAULT false,
                created_at timestamptz NOT NULL DEFAULT NOW(),
                approved_at timestamptz NULL,
                approved_by_id integer NULL REFERENCES api_user(id) ON DELETE SET NULL
              );
            EXCEPTION
              WHEN duplicate_table THEN NULL;
              WHEN unique_violation THEN NULL;
            END $$;
            """
        )

        # Status index — ignore if Django already created api_organization_status_idx
        cursor.execute(
            """
            DO $$ BEGIN
              CREATE INDEX api_organization_status_idx ON api_organization (status);
            EXCEPTION
              WHEN duplicate_table THEN NULL;
              WHEN unique_violation THEN NULL;
              WHEN duplicate_object THEN NULL;
            END $$;
            """
        )

        cursor.execute(
            """
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='api_user' AND column_name='organization_id'
              ) THEN
                ALTER TABLE api_user
                  ADD COLUMN organization_id bigint NULL
                  REFERENCES api_organization(id) ON DELETE SET NULL;
              END IF;
            END $$;
            """
        )
        cursor.execute(
            """
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='api_user' AND column_name='hrms_user_id'
              ) THEN
                ALTER TABLE api_user ADD COLUMN hrms_user_id varchar(64) NOT NULL DEFAULT '';
              END IF;
            END $$;
            """
        )
        cursor.execute(
            """
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='api_user' AND column_name='can_edit_leads'
              ) THEN
                ALTER TABLE api_user ADD COLUMN can_edit_leads boolean NOT NULL DEFAULT true;
              END IF;
            END $$;
            """
        )
        cursor.execute(
            """
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='api_project' AND column_name='organization_id'
              ) THEN
                ALTER TABLE api_project
                  ADD COLUMN organization_id bigint NULL
                  REFERENCES api_organization(id) ON DELETE CASCADE;
              END IF;
            END $$;
            """
        )

        cursor.execute(
            """
            DO $$ BEGIN
              CREATE TABLE IF NOT EXISTS api_verificationwork (
                id bigserial PRIMARY KEY,
                title varchar(200) NOT NULL DEFAULT 'Verify documents',
                status varchar(20) NOT NULL DEFAULT 'open',
                priority varchar(20) NOT NULL DEFAULT 'normal',
                due_date date NULL,
                assign_notes text NOT NULL DEFAULT '',
                completion_notes text NOT NULL DEFAULT '',
                allow_edit boolean NOT NULL DEFAULT true,
                completed_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT NOW(),
                updated_at timestamptz NOT NULL DEFAULT NOW(),
                assigned_by_id integer NULL REFERENCES api_user(id) ON DELETE SET NULL,
                assigned_to_id integer NULL REFERENCES api_user(id) ON DELETE SET NULL,
                document_id bigint NULL REFERENCES api_leaddocument(id) ON DELETE SET NULL,
                form_submission_id bigint NULL REFERENCES api_formsubmission(id) ON DELETE SET NULL,
                lead_id bigint NOT NULL REFERENCES api_lead(id) ON DELETE CASCADE,
                organization_id bigint NULL REFERENCES api_organization(id) ON DELETE CASCADE
              );
            EXCEPTION
              WHEN duplicate_table THEN NULL;
              WHEN unique_violation THEN NULL;
            END $$;
            """
        )
        cursor.execute(
            """
            DO $$ BEGIN
              CREATE INDEX api_verificationwork_status_idx ON api_verificationwork (status);
            EXCEPTION
              WHEN duplicate_table THEN NULL;
              WHEN unique_violation THEN NULL;
              WHEN duplicate_object THEN NULL;
            END $$;
            """
        )

        cursor.execute("SELECT id FROM api_organization WHERE slug = %s", ["default"])
        row = cursor.fetchone()
        if row:
            org_id = row[0]
        else:
            cursor.execute(
                """
                INSERT INTO api_organization (
                    name, slug, email, phone, city, status, plan_label, trial_ends_at,
                    payment_notes, hrms_connected, hrms_company_id, hrms_api_base_url,
                    admin_name, is_public, created_at, approved_at, approved_by_id
                ) VALUES (
                    %s, %s, %s, '', '', 'active', 'Legacy', NULL,
                    '', false, '', 'https://hrms.trackbook.co',
                    '', true, %s, %s, NULL
                ) RETURNING id
                """,
                ["Default Company", "default", "admin@crm.local", now, now],
            )
            org_id = cursor.fetchone()[0]

        cursor.execute(
            "UPDATE api_project SET organization_id = %s WHERE organization_id IS NULL",
            [org_id],
        )
        cursor.execute(
            "UPDATE api_user SET organization_id = %s WHERE organization_id IS NULL AND COALESCE(role, '') <> %s",
            [org_id, "SuperAdmin"],
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0013_organization_verification_work"),
    ]

    operations = [
        migrations.RunPython(repair_and_seed, noop_reverse),
    ]
