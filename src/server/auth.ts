// ============================================
// 인증 라우터 (JWT 기반)
// ============================================

import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma } from '@prisma/client';
import { loadProjectEnv } from '../lib/env/load-project-env';

loadProjectEnv();

const prisma = new PrismaClient();
const auth = new Hono();

// JWT 시크릿 키
const JWT_SECRET = process.env.JWT_SECRET || 'naver-land-secret-key-change-in-production';
const JWT_EXPIRES_IN = 60 * 60 * 24 * 7; // 7일 (초 단위)

function normalizeEmail(value: unknown) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * POST /api/auth/register
 * 회원가입
 */
auth.post('/register', async (c) => {
    try {
        const body = await c.req.json();
        const email = normalizeEmail(body?.email);
        const password = typeof body?.password === 'string' ? body.password : '';
        const name = typeof body?.name === 'string' ? body.name.trim() : '';

        if (!email || !password) {
            return c.json({ error: '이메일과 비밀번호를 입력해주세요.' }, 400);
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return c.json({ error: '올바른 이메일 형식이 아닙니다.' }, 400);
        }
        if (password.length < 6) {
            return c.json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' }, 400);
        }

        // 이메일 중복 확인
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return c.json({ error: '이미 가입된 이메일입니다.' }, 409);
        }

        // 비밀번호 해시
        const hashedPassword = await bcrypt.hash(password, 10);

        // 사용자 생성
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || email.split('@')[0],
                provider: 'local',
            },
            select: { id: true, email: true, name: true, role: true },
        });

        // JWT 토큰 생성
        const token = await sign(
            { sub: user.id, email: user.email ?? email, exp: Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN },
            JWT_SECRET
        );

        return c.json({ success: true, user, token });
    } catch (error) {
        console.error('Register error:', error);
        if (error instanceof Prisma.PrismaClientInitializationError) {
            return c.json({ error: '데이터베이스 연결에 실패했습니다. DB 서버 상태를 확인해주세요.' }, 503);
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return c.json({ error: '이미 가입된 이메일입니다.' }, 409);
        }
        return c.json({ error: '회원가입에 실패했습니다.' }, 500);
    }
});

/**
 * POST /api/auth/login
 * 로그인
 */
auth.post('/login', async (c) => {
    try {
        const body = await c.req.json();
        const email = normalizeEmail(body?.email);
        const password = typeof body?.password === 'string' ? body.password : '';

        if (!email || !password) {
            return c.json({ error: '이메일과 비밀번호를 입력해주세요.' }, 400);
        }

        // 사용자 조회
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) {
            return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
        }

        // 비밀번호 확인
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
        }

        // 마지막 로그인 시간 업데이트
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        // JWT 토큰 생성
        const token = await sign(
            { sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN },
            JWT_SECRET
        );

        return c.json({
            success: true,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            token,
        });
    } catch (error) {
        console.error('Login error:', error);
        if (error instanceof Prisma.PrismaClientInitializationError) {
            return c.json({ error: '데이터베이스 연결에 실패했습니다. DB 서버 상태를 확인해주세요.' }, 503);
        }
        return c.json({ error: '로그인에 실패했습니다.' }, 500);
    }
});

/**
 * GET /api/auth/me
 * 현재 사용자 정보 조회
 */
auth.get('/me', async (c) => {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
        return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true, email: true, name: true, role: true,
            companyName: true, businessNumber: true,
            themeMode: true, accentColor: true, fontSize: true, borderRadius: true, compactMode: true,
            createdAt: true, lastLoginAt: true,
        },
    });

    if (!user) {
        return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);
    }

    return c.json({ success: true, user });
});

/**
 * JWT 토큰에서 userId 추출하는 유틸 함수
 */
export async function getUserIdFromRequest(c: any): Promise<string | null> {
    try {
        // Try both 'Authorization' and 'authorization' headers
        let authHeader = c.req.header('Authorization');
        if (!authHeader) {
            authHeader = c.req.header('authorization');
        }
        if (!authHeader?.startsWith('Bearer ')) return null;

        const token = authHeader.slice(7);
        const payload = await verify(token, JWT_SECRET, 'HS256');
        return (payload.sub as string) || null;
    } catch {
        return null;
    }
}

export default auth;
