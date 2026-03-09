import { fetchRebTableData } from './src/lib/public-data/reb-client';

async function test() {
    try {
        const res = await fetchRebTableData({
            statblId: 'A_2024_00900',
            page: 1,
            size: 10,
            type: 'json'
        });
        console.log('Result length:', res.rows.length);
        console.log('First row:', res.rows[0]);
        console.log('listTotalCount:', res.listTotalCount);
    } catch (e) {
        console.error('Err:', e);
    }
}
test();
