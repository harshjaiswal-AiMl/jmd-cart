#!/usr/bin/env python3
"""
JMD Cart - Automated Database Backup & Email Script
Exports Cloud SQL Postgres database to Google Cloud Storage and emails
the compressed .sql.gz backup file to the administrator.
"""

import os
import sys
import smtplib
import subprocess
import tempfile
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

PROJECT = os.environ.get("GCP_PROJECT", "jmd-cart")
SQL_INSTANCE = os.environ.get("SQL_INSTANCE", "jmd-cart-db")
DB_NAME = os.environ.get("DB_NAME", "jmdcart")
BUCKET = os.environ.get("GCS_BUCKET", "jmd-cart-uploads")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "info.jmdcart@gmail.com")
RECIPIENT_EMAIL = os.environ.get("RECIPIENT_EMAIL", "info.jmdcart@gmail.com")
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))

def get_smtp_password():
    # 1. Check environment variable
    pwd = os.environ.get("BACKUP_SMTP_PASS")
    if pwd:
        return pwd.strip()
    # 2. Fetch from Google Secret Manager
    try:
        res = subprocess.run(
            ["gcloud", "secrets", "versions", "access", "latest", "--secret=BACKUP_SMTP_PASS", f"--project={PROJECT}"],
            capture_output=True,
            text=True,
            check=True
        )
        return res.stdout.strip()
    except Exception as e:
        print(f"Error fetching SMTP password from Secret Manager: {e}", file=sys.stderr)
        sys.exit(1)

def run():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"jmdcart_backup_{timestamp}.sql.gz"
    gcs_uri = f"gs://{BUCKET}/backups/{backup_filename}"

    print(f"[{datetime.now().isoformat()}] Step 1: Exporting Cloud SQL database '{DB_NAME}' to {gcs_uri}...")
    export_cmd = [
        "gcloud", "sql", "export", "sql", SQL_INSTANCE, gcs_uri,
        f"--database={DB_NAME}",
        f"--project={PROJECT}",
        "--quiet"
    ]
    subprocess.run(export_cmd, check=True)
    print(f"[{datetime.now().isoformat()}] Database exported successfully to Cloud Storage.")

    with tempfile.TemporaryDirectory() as tmpdir:
        local_path = os.path.join(tmpdir, backup_filename)
        print(f"[{datetime.now().isoformat()}] Step 2: Downloading export for email attachment...")
        subprocess.run(["gcloud", "storage", "cp", gcs_uri, local_path], check=True)
        file_size_kb = os.path.getsize(local_path) / 1024.0

        print(f"[{datetime.now().isoformat()}] Step 3: Preparing email (File size: {file_size_kb:.2f} KB)...")
        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = RECIPIENT_EMAIL
        date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")
        msg["Subject"] = f"📦 JMD Cart - Full Database Backup ({datetime.now().strftime('%d %b %Y')})"

        body = f"""Hello,

Your automated full database backup for JMD Cart is attached below.

Backup Details:
- Date & Time: {date_str}
- Database: {DB_NAME} (PostgreSQL 16)
- File Name: {backup_filename}
- Compressed Size: {file_size_kb:.2f} KB
- Cloud Storage Archive: {gcs_uri}

Contents:
- Complete Storefront & Order history
- POS Billing, GST Invoices & Tax records
- Central Godown & Van Stock Movements
- Supplier & Customer Credit Ledgers
- Staff user accounts & permissions

Keep this file safe for disaster recovery.

--
JMD Cart Automated Operations
Saharsa, Bihar
"""
        msg.attach(MIMEText(body, "plain"))

        with open(local_path, "rb") as f:
            part = MIMEApplication(f.read(), Name=backup_filename)
            part["Content-Disposition"] = f'attachment; filename="{backup_filename}"'
            msg.attach(part)

        smtp_pass = get_smtp_password()
        print(f"[{datetime.now().isoformat()}] Step 4: Sending email to {RECIPIENT_EMAIL}...")
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SENDER_EMAIL, smtp_pass)
            server.sendmail(SENDER_EMAIL, [RECIPIENT_EMAIL], msg.as_string())

        print(f"[{datetime.now().isoformat()}] SUCCESS: Backup email sent to {RECIPIENT_EMAIL}!")

if __name__ == "__main__":
    run()
