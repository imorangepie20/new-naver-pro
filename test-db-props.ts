import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const toRad = (deg: number) => (deg * Math.PI) / 180;
const haversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const cVal = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * cVal;
};

async function testLocalProps() {
    // Let's get the most recent property to find a valid center coordinate
    const sampleProp = await prisma.property.findFirst({
        where: { latitude: { not: null }, longitude: { not: null } },
        orderBy: { createdAt: 'desc' }
    });

    if (!sampleProp) {
        console.log('No properties found in DB at all.');
        return;
    }

    const centerLat = sampleProp.latitude!;
    const centerLng = sampleProp.longitude!;
    const radiusMeters = 1000;

    console.log(`Testing around lat: ${centerLat}, lng: ${centerLng}`);

    const propMeters = radiusMeters;
    const safeCosProp = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.01);
    const latDeltaProp = propMeters / 111320;
    const lngDeltaProp = propMeters / (111320 * safeCosProp);

    const whereClause: any = {
        latitude: {
            not: null,
            gte: centerLat - latDeltaProp,
            lte: centerLat + latDeltaProp,
        },
        longitude: {
            not: null,
            gte: centerLng - lngDeltaProp,
            lte: centerLng + lngDeltaProp,
        },
    };

    const localProps = await prisma.property.findMany({
        where: whereClause,
    });

    console.log(`Found ${localProps.length} props in bounding box.`);

    const scopedProps = localProps.filter((p) => {
        if (p.latitude === null || p.longitude === null) return false;
        const dist = haversineMeters(centerLat, centerLng, p.latitude, p.longitude);
        return dist <= radiusMeters;
    });

    console.log(`Found ${scopedProps.length} props within ${radiusMeters}m radius.`);
}

testLocalProps().catch(console.error).finally(() => prisma.$disconnect());
