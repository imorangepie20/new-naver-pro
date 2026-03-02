import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

// Railway PostgreSQL connection
const client = new Client({
  connectionString: 'postgresql://postgres:nCfsGXaOYiopEBXhBWlJtcFQuCfbeoXq@1ff10d9f-f6ed-4549-8373-bd4373bd2a34.r.railway.app:5432/railway',
  ssl: { rejectUnauthorized: false }
});

async function exportData() {
  try {
    await client.connect();
    console.log('Connected to Railway DB');

    // Get all table names
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    console.log('Tables:', tables.rows.map(r => r.table_name));

    // Export each table
    for (const row of tables.rows) {
      const tableName = row.table_name;
      console.log(`Exporting ${tableName}...`);

      const data = await client.query(`SELECT * FROM ${tableName}`);
      fs.writeFileSync(`/tmp/${tableName}.json`, JSON.stringify(data.rows, null, 2));
      console.log(`  ${data.rowCount} rows`);
    }

    console.log('Export complete! Files saved to /tmp/');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

exportData();
