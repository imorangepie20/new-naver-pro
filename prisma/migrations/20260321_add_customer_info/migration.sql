-- 고객 정보 테이블 추가
-- 생성일: 2026-03-21

CREATE TABLE "customer_info" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerKey" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_info_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_info_userId_customerKey_key" ON "customer_info"("userId", "customerKey");
CREATE INDEX "customer_info_userId_idx" ON "customer_info"("userId");

ALTER TABLE "customer_info"
ADD CONSTRAINT "customer_info_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON TABLE "customer_info" IS '고객 정보';
COMMENT ON COLUMN "customer_info".id IS '고객 정보 고유 ID';
COMMENT ON COLUMN "customer_info"."userId" IS '사용자 ID';
COMMENT ON COLUMN "customer_info"."customerKey" IS '고객 매칭 키 (내부용)';
COMMENT ON COLUMN "customer_info"."customerName" IS '고객명';
COMMENT ON COLUMN "customer_info"."customerPhone" IS '연락처';
COMMENT ON COLUMN "customer_info".memo IS '고객 메모';
COMMENT ON COLUMN "customer_info"."createdAt" IS '등록일';
COMMENT ON COLUMN "customer_info"."updatedAt" IS '수정일';
