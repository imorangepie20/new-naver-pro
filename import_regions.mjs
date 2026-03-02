import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://root:password@localhost:5432/naver_land'
});

async function importRegions() {
  try {
    await client.connect();
    console.log('Connected to local DB');

    // Fetch regions from Railway API
    const response = await fetch('https://web-production-e567c.up.railway.app/api/regions/tree');
    const data = await response.json();

    // Flatten the tree structure
    function flattenRegions(nodes, parentNo = null) {
      const regions = [];
      for (const node of nodes) {
        regions.push({
          cortarNo: node.cortarNo,
          cortarName: node.cortarName,
          cortarType: node.cortarType,
          parentCortarNo: node.parentCortarNo || parentNo,
          centerLat: node.centerLat,
          centerLon: node.centerLon,
          depth: node.depth || 0
        });
        if (node.children && node.children.length > 0) {
          regions.push(...flattenRegions(node.children, node.cortarNo));
        }
      }
      return regions;
    }

    const regions = flattenRegions(data.tree);
    console.log(`Found ${regions.length} regions`);

    // Clear existing regions
    await client.query('DELETE FROM regions');
    console.log('Cleared existing regions');

    // Insert regions
    for (const region of regions) {
      await client.query(
        `INSERT INTO regions ("cortarNo", "cortarName", "cortarType", "parentCortarNo", "centerLat", "centerLon", "depth", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT ("cortarNo") DO UPDATE SET
           "cortarName" = EXCLUDED."cortarName",
           "centerLat" = EXCLUDED."centerLat",
           "centerLon" = EXCLUDED."centerLon"`,
        [region.cortarNo, region.cortarName, region.cortarType, region.parentCortarNo, region.centerLat, region.centerLon, region.depth]
      );
    }

    console.log(`Imported ${regions.length} regions`);

    // Verify
    const count = await client.query('SELECT COUNT(*) as count FROM regions');
    console.log(`Total regions in DB: ${count.rows[0].count}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

importRegions();
