import { v4 as uuidv4 } from 'uuid';
import { Grade, User } from '../types';
import {
  findUser,
  findUserByStudentCode,
  isDatabaseConnected,
  saveUser,
} from './storage';

// ĐỔI thành link Vercel công khai của Website Học Tập (không dấu / ở cuối)
const PORTAL_API = (
  import.meta.env.VITE_PORTAL_API_URL ||
  'https://hocvatly-thpt.vercel.app/'
).replace(/\/+$/, '');

const SSO_PROOF_KEY = 'eduquiz_sso_proof';

interface PortalSsoUser {
  studentId?: string;
  username: string;
  fullName?: string;
  grade?: number | string;
}

const toEduQuizGrade = (rawGrade: unknown): Grade => {
  const g = String(rawGrade ?? '').trim();
  if (g === '10' || g === '11' || g === '12') return g as Grade;
  return '11' as Grade;
};

const upsertSyncedStudent = async (
  portalUser: PortalSsoUser,
  plainPassword?: string
): Promise<User> => {
  const rawCode = String(portalUser.username || '').trim();
  const upperCode = rawCode.toUpperCase();
  const lowerUser = rawCode.toLowerCase();

  let existing: User | undefined;
  if (isDatabaseConnected()) {
    existing =
      (await findUserByStudentCode(upperCode)) ||
      (await findUser(lowerUser));
  }

  if (existing) {
    // Giữ nguyên classId, className, academicYear, points... đã xếp lớp bên EduQuiz
    const merged: User = {
      ...existing,
      username: existing.username || lowerUser,
      studentCode: existing.studentCode || upperCode,
      fullName: existing.fullName || String(portalUser.fullName || upperCode).trim(),
      grade: existing.grade || toEduQuizGrade(portalUser.grade),
      ...(plainPassword !== undefined ? { password: plainPassword } : {}),
    };

    if (
      isDatabaseConnected() &&
      (plainPassword !== undefined ||
        !existing.studentCode ||
        !existing.grade)
    ) {
      await saveUser(merged);
    }
    return merged;
  }

  const newUser: User = {
    id: uuidv4(),
    username: lowerUser,
    studentCode: upperCode,
    fullName: String(portalUser.fullName || upperCode).trim(),
    password: plainPassword || '',
    role: 'student',
    grade: toEduQuizGrade(portalUser.grade),
  } as User;

  if (isDatabaseConnected()) {
    await saveUser(newUser);
  }
  return newUser;
};

/** 1. Tự đăng nhập khi học sinh bấm link có ?sso_token=... từ Website Học Tập */
export const loginViaEcosystemSSO = async (): Promise<User | null> => {
  const params = new URLSearchParams(window.location.search);
  const ssoToken = params.get('sso_token');
  if (!ssoToken) return null;

  // Xóa sso_token khỏi thanh địa chỉ nhưng giữ nguyên ?quiz=... nếu có
  params.delete('sso_token');
  const nextSearch = params.toString();
  const cleanUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', cleanUrl);

  try {
    const res = await fetch(
      `${PORTAL_API}/api/sso/verify?token=${encodeURIComponent(ssoToken)}`
    );
    const data = await res.json();
    if (!res.ok || !data?.valid || !data?.user) return null;

    if (data.syncProof) {
      localStorage.setItem(SSO_PROOF_KEY, String(data.syncProof));
    }
    return await upsertSyncedStudent(data.user);
  } catch (err) {
    console.warn('SSO verify error:', err);
    return null;
  }
};

/** 2. Đăng nhập chéo qua Website Học Tập nếu mở trực tiếp EduQuiz VN */
export const loginWithPortalFallback = async (
  studentCode: string,
  password: string
): Promise<User | null> => {
  try {
    const res = await fetch(`${PORTAL_API}/api/sso/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: studentCode.trim(),
        password,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.valid || !data?.user) return null;

    if (data.syncProof) {
      localStorage.setItem(SSO_PROOF_KEY, String(data.syncProof));
    }
    return await upsertSyncedStudent(data.user, password);
  } catch (err) {
    console.warn('Portal fallback auth error:', err);
    return null;
  }
};

/** 3. Kiểm tra mật khẩu cũ chéo sang Website Học Tập khi học sinh đăng nhập bằng SSO */
export const verifyPortalCurrentPassword = async (
  username: string,
  currentPassword: string
): Promise<boolean> => {
  try {
    const res = await fetch(`${PORTAL_API}/api/sso/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.trim(),
        password: currentPassword,
      }),
    });
    const data = await res.json();
    if (res.ok && data?.valid) {
      if (data.syncProof) {
        localStorage.setItem(SSO_PROOF_KEY, String(data.syncProof));
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

/** 4. Ping đồng bộ mật khẩu mới về bảng students bên Website Học Tập */
export const syncPasswordToPortal = async (params: {
  username: string;
  newPassword: string;
  oldPassword?: string;
}): Promise<{ ok: boolean; error?: string }> => {
  try {
    const syncProof = localStorage.getItem(SSO_PROOF_KEY) || '';
    const res = await fetch(`${PORTAL_API}/api/sso/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: params.username.trim(),
        newPassword: params.newPassword,
        oldPassword: params.oldPassword || '',
        syncProof,
      }),
    });
    const data = await res.json();
    return { ok: Boolean(res.ok && data?.ok), error: data?.error };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ Website Học Tập.' };
  }
};
