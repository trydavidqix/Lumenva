# Database Migration: Supabase to Cloud SQL

This runbook details the step-by-step procedure to migrate our production data from Supabase to Google Cloud SQL (PostgreSQL) as part of Wave 4 (Data Core to Google), with zero to minimal downtime.

## Strategy Overview

For a minimal downtime approach, we utilize the **Google Cloud Database Migration Service (DMS)**. DMS handles continuous data replication from the source (Supabase) to the destination (Cloud SQL) using logical replication, allowing us to seamlessly cut over the application with just seconds of downtime.

If logical replication is not an option (due to Supabase extensions or permissions), the fallback strategy is an offline migration using **pg_dump/pg_restore**. 

---

## 1. Primary Strategy: Minimal Downtime (Cloud DMS)

### Phase 1: Preparation (No Downtime)
1. **Source Configuration (Supabase)**:
   - Enable logical replication on the Supabase PostgreSQL database. 
   - Ensure the publication is set for all necessary tables.
   - Configure Supabase firewall/pg_hba.conf to allow the Google Cloud DMS IP address space.
2. **Destination Configuration (Google Cloud)**:
   - Ensure the destination Cloud SQL instance is provisioned (via Terraform `foundation` module).
   - Verify network connectivity between the Cloud SQL instance and the Database Migration Service VPC.

### Phase 2: Establish Migration Job (No Downtime)
1. Navigate to Google Cloud Console > Database Migration.
2. Create a new **Migration Job**.
3. Set **Source profile** using the Supabase connection string.
4. Set **Destination profile** using the provisioned Cloud SQL instance.
5. Select **Continuous** (CDC) migration type.
6. Start the migration job. DMS will perform an initial snapshot of the database and begin catching up with ongoing transactions.

### Phase 3: The Cutover (Minimal Downtime)
1. **Verify Replication**: Monitor the migration job until the status shows as **"CDC in progress"** with low replication lag.
2. **Freeze Application**: Place the Lumenva application in maintenance mode or stop writes to the API. This ensures no new data is written to Supabase during the cutover.
3. **Wait for Sync**: Allow a few moments for the final transactions to sync to Cloud SQL. Verify the lag drops to zero.
4. **Promote Cloud SQL**: In the DMS console, click **Promote** to finalize the migration. The Cloud SQL instance will become read/write.
5. **Update Connections**: 
   - Update Secret Manager (`DB_HOST`, `DB_USER`, `DB_PASSWORD`) to point to the new Cloud SQL instance.
   - Restart the Cloud Run services to pick up the new database credentials.
6. **Lift Freeze**: Disable maintenance mode. The application is now running against Cloud SQL.

---

## 2. Fallback Strategy: Offline Migration (pg_dump/pg_restore)

If DMS cannot be used, we will schedule a maintenance window.

1. **Pre-requisites**: Provision Cloud SQL via Terraform.
2. **Freeze**: Enable maintenance mode.
3. **Backup**: Run `pg_dump -Fc -h <supabase_host> -U <supabase_user> -d postgres > backup.dump`.
4. **Restore**: Run `pg_restore -d "postgresql://<cloudsql_user>:<password>@<cloudsql_host>/<dbname>" -1 backup.dump`.
5. **Verify**: Run `COUNT(*)` checks on primary tables to ensure parity.
6. **Reconfigure & Restart**: Update application secrets and deploy.

## Rollback Plan
- DO NOT delete the Supabase instance immediately.
- If the Cloud SQL deployment fails, switch the application's connection string back to Supabase.
- If writes occurred in Cloud SQL and you need to rollback, manual delta resolution or accepting data loss for the cutover window will be required.

## Post-Migration Cleanup
- Decommission Database Migration Service job.
- Turn off Supabase logical replication publication.
- After 1 week of stable operation, initiate decommissioning of the Supabase project.
