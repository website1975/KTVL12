// Code gắn vào EduQuiz VN (bảng users: username + data JSON)
const PORTAL_API = "https://hocvatly-thpt.vercel.app";

// 1. Vào từ Website Học Vật Lý (?sso_token=...) -> tự động đăng nhập thẳng EduQuiz VN
export async function loginViaEcosystemSSO(supabaseEduQuiz) {
  const params = new URLSearchParams(window.location.search);
  const ssoToken = params.get("sso_token");
  if (!ssoToken) return null;

  const res = await fetch(`${PORTAL_API}/api/sso/verify?token=${encodeURIComponent(ssoToken)}`);
  const { valid, user, syncProof } = await res.json();
  if (!valid || !user?.username) return null;

  const { data: existing } = await supabaseEduQuiz
    .from("users")
    .select("*")
    .eq("username", user.username)
    .maybeSingle();

  const mergedData = {
    ...(existing?.data || {}),
    fullName: user.fullName || user.username,
    grade: user.grade,
    ssoLinked: true,
    portalStudentId: user.studentId,
    portalSyncProof: syncProof || existing?.data?.portalSyncProof || "",
  };

  if (existing) {
    await supabaseEduQuiz.from("users").update({ data: mergedData }).eq("username", user.username);
  } else {
    await supabaseEduQuiz.from("users").insert([{ username: user.username, data: mergedData }]);
  }

  params.delete("sso_token");
  window.history.replaceState({}, "", window.location.pathname + (params.toString() ? "?" + params.toString() : ""));
  return { username: user.username, data: mergedData };
}

// 2. HS đổi mật khẩu bên EduQuiz VN -> ping đồng bộ đổi luôn bên Web Học Vật Lý
export async function syncPasswordToPortal({ username, newPassword, oldPassword, syncProof }) {
  const res = await fetch(`${PORTAL_API}/api/sso/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, newPassword, oldPassword, syncProof }),
  });
  return res.json(); // { ok: true }
}

// 3. Đăng nhập trực tiếp trên EduQuiz bằng MSHS + Mật khẩu Web Học Vật Lý
export async function loginWithPortalCredentials(username, password) {
  const res = await fetch(`${PORTAL_API}/api/sso/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return res.json(); // { valid, token, syncProof, user }
}
