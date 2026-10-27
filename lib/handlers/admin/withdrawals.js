import { requireAdmin } from "../../auth.js";
import { readJson, bad } from "../../http.js";
import { listWithdrawals, createWithdrawal, setWithdrawalStatus, getDashboardStats, demoMode } from "../../db.js";

const TYPES = ["GoPay", "DANA", "ShopeePay", "Bank Lainnya"];
// GET: daftar pengajuan penarikan. POST: ajukan baru, atau {id, status:"selesai"} tandai selesai.
// Penarikan di sini hanya pengajuan — transfernya dilakukan owner utama secara manual.
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method === "GET") {
    return res.status(200).json({ withdrawals: await listWithdrawals(), demo: demoMode });
  }
  if (req.method !== "POST") return bad(res, 405, "Method tidak diizinkan");
  const body = await readJson(req);
  if (body.id && body.status === "selesai") {
    const w = await setWithdrawalStatus(String(body.id), "selesai");
    if (!w) return bad(res, 404, "Pengajuan tidak ditemukan");
    return res.status(200).json({ withdrawal: w });
  }
  const name = String(body.name || "").trim();
  const accountType = String(body.account_type || "");
  const accountNumber = String(body.account_number || "").trim();
  const amount = Number(body.amount || 0);
  if (!name) return bad(res, 400, "Nama wajib diisi");
  if (!TYPES.includes(accountType)) return bad(res, 400, "Jenis rekening tidak dikenal");
  if (!accountNumber) return bad(res, 400, "Nomor rekening / e-wallet wajib diisi");
  if (!(Number.isInteger(amount) && amount > 0)) return bad(res, 400, "Nominal harus angka bulat > 0");
  const stats = await getDashboardStats();
  const available = stats.withdrawals ? stats.withdrawals.available : 0;
  if (amount > available) return bad(res, 400, `Nominal melebihi saldo tersedia (Rp${available.toLocaleString("id-ID")})`);
  const w = await createWithdrawal({ name, account_type: accountType, account_number: accountNumber, amount });
  return res.status(200).json({ withdrawal: w });
}
