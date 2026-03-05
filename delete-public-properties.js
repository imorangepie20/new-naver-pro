import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.property.count({ where: { userId: null } });
  console.log(`공용 매물(userId=null) 개수: ${count}`);
  
  if (count > 0) {
    const result = await prisma.property.deleteMany({ where: { userId: null } });
    console.log(`${result.count}개의 공용 매물 삭제 완료`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
