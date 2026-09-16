import React, { useState } from 'react';
import {
  User,
  School,
  Sparkles,
  CheckCircle2,
  Trophy,
  X,
  Mail,
  Lock,
  LogIn,
  UserPlus,
  LogOut,
  Database,
  AlertCircle,
  Loader2,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Settings,
  Info,
  ExternalLink
} from 'lucide-react';
import { UserProfile } from '../types';
import { DEFAULT_AVATARS, getLevelTitle, loadSavedAccounts, saveRegisteredAccount, removeSavedAccount, SavedAccountItem } from '../utils/storage';
import {
  isSupabaseConfigured,
  getSupabase,
  signInWithSupabase,
  signUpWithSupabase,
  signOutSupabase
} from '../lib/supabase';
import { playClickSound } from '../utils/audio';

interface LoginModalProps {
  isOpen: boolean;
  currentUser: UserProfile | null;
  onClose?: () => void;
  onLogin: (profile: UserProfile) => void;
  onLogout?: () => void;
  onOpenSqlGuide?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onLogin,
  onLogout,
  onOpenSqlGuide,
}) => {
  const [authMode, setAuthMode] = useState<'quick' | 'signin' | 'signup'>('quick');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [organization, setOrganization] = useState('Lớp 11A1 - CLB STEM');
  const [selectedAvatar, setSelectedAvatar] = useState('🌱');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'invalid_cred' | 'email_not_confirmed' | 'email_rate_limit' | 'missing_table' | 'other' | null>(null);
  const [showRateLimitGuide, setShowRateLimitGuide] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccountItem[]>(() => loadSavedAccounts());

  const supabaseReady = isSupabaseConfigured();

  if (!isOpen) return null;

  // Quick Play handler without password
  const handleQuickPlay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorType(null);
    setSuccessMsg(null);
    playClickSound();

    if (!username.trim()) {
      setError('Vui lòng nhập tên thí sinh hoặc đội thi.');
      return;
    }

    setLoading(true);
    const sanitizedName = username.trim();
    const safeEmail = email.trim() || `${sanitizedName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'player'}_${Date.now()}@ecosort.stem`;

    const profile: UserProfile = {
      id: 'user-' + Date.now(),
      name: sanitizedName,
      email: safeEmail,
      organization: organization.trim() || 'Khối Sáng Tạo STEM',
      avatar: selectedAvatar,
      totalPoints: 0,
      correctCount: 0,
      organicCount: 0,
      recyclableCount: 0,
      inorganicCount: 0,
      createdAt: Date.now(),
    };

    // Upsert to Supabase players table if connected
    if (supabaseReady) {
      try {
        const client = getSupabase();
        if (client) {
          await client.from('players').upsert({
            id: profile.id,
            username: profile.name,
            email: profile.email,
            organization: profile.organization,
            avatar: profile.avatar,
            total_points: 0,
            correct_count: 0,
          });
        }
      } catch (err) {
        console.log('Supabase quick play sync note:', err);
      }
    }

    if (profile.email && profile.email.includes('@')) {
      saveRegisteredAccount({
        email: profile.email,
        name: profile.name,
        organization: profile.organization,
        avatar: profile.avatar,
      });
      setSavedAccounts(loadSavedAccounts());
    }

    setTimeout(() => {
      setLoading(false);
      setSuccessMsg(`Chào mừng thí sinh ${profile.name}! Khởi tạo 0 điểm.`);
      setTimeout(() => {
        onLogin(profile);
      }, 400);
    }, 300);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorType(null);
    setSuccessMsg(null);
    playClickSound();

    if (!email.trim() || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Mật khẩu cần tối thiểu 6 ký tự.');
      return;
    }

    if (authMode === 'signup' && !username.trim()) {
      setError('Vui lòng nhập tên người dùng / tên đội thi.');
      return;
    }

    setLoading(true);

    if (supabaseReady) {
      // 1. ONLINE AUTHENTICATION VIA SUPABASE
      if (authMode === 'signup') {
        const { user, error: authErr } = await signUpWithSupabase(
          email,
          password,
          username,
          organization,
          selectedAvatar
        );

        setLoading(false);

        if (authErr) {
          const lower = authErr.toLowerCase();
          if (authErr.includes('User already registered')) {
            setError('Email này đã được đăng ký trước đó! Vui lòng chuyển sang tab Đăng Nhập.');
            setErrorType('invalid_cred');
          } else if (authErr.includes('Password should be at least')) {
            setError('Mật khẩu cần có ít nhất 6 ký tự.');
            setErrorType('other');
          } else if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) {
            setError('Máy chủ Supabase bị giới hạn số email gửi xác nhận (email rate limit exceeded: tối đa 3-4 mail/giờ). Hãy bấm nút "Vào chơi & Lưu điểm ngay" bên dưới để thi đấu, hoặc tắt "Confirm email" trong cài đặt Supabase!');
            setErrorType('email_rate_limit');
            setShowRateLimitGuide(true);
          } else {
            setError(authErr);
            setErrorType('other');
          }
          return;
        }

        if (user) {
          saveRegisteredAccount({
            email: user.email,
            name: user.name,
            organization: user.organization,
            avatar: user.avatar,
          });
          setSavedAccounts(loadSavedAccounts());
          setSuccessMsg('Đăng ký tài khoản thành công! Điểm khởi tạo: 0 điểm.');
          setTimeout(() => {
            onLogin(user);
          }, 800);
        }
      } else {
        const { user, error: authErr } = await signInWithSupabase(email, password);
        setLoading(false);

        if (authErr) {
          const lower = authErr.toLowerCase();
          if (lower.includes('invalid login credentials')) {
            setError('Sai email hoặc mật khẩu! Nếu bạn chưa có tài khoản, vui lòng bấm "Đăng Ký Mới" hoặc dùng chế độ "Tham Gia Nhanh".');
            setErrorType('invalid_cred');
          } else if (lower.includes('email not confirmed')) {
            setError('Tài khoản này chưa xác nhận email trên Supabase. Bạn có thể nhấn nút "Vào chơi ngay" bên dưới để thi đấu ngay lập tức!');
            setErrorType('email_not_confirmed');
          } else if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) {
            setError('Máy chủ Supabase bị giới hạn số email (email rate limit exceeded). Hãy bấm "Vào chơi & Lưu điểm ngay" bên dưới để tiếp tục!');
            setErrorType('email_rate_limit');
            setShowRateLimitGuide(true);
          } else if (authErr.includes('relation "public.players" does not exist')) {
            setError('Chưa tạo bảng "players" trên Supabase! Vui lòng bấm "Xem lệnh SQL" và dán vào SQL Editor của Supabase.');
            setErrorType('missing_table');
          } else {
            setError(authErr);
            setErrorType('other');
          }
          return;
        }

        if (user) {
          saveRegisteredAccount({
            email: user.email,
            name: user.name,
            organization: user.organization,
            avatar: user.avatar,
          });
          setSavedAccounts(loadSavedAccounts());
          setSuccessMsg(`Chào mừng trở lại, ${user.name}!`);
          setTimeout(() => {
            onLogin(user);
          }, 600);
        }
      }
    } else {
      // 2. LOCAL FALLBACK MODE
      const nameToUse = authMode === 'signup' ? username.trim() : email.split('@')[0];
      const profile: UserProfile = {
        id: 'user-' + Date.now(),
        name: nameToUse,
        email: email.trim(),
        organization: organization.trim() || 'Khối Sáng Tạo STEM',
        avatar: selectedAvatar,
        totalPoints: 0,
        correctCount: 0,
        organicCount: 0,
        recyclableCount: 0,
        inorganicCount: 0,
        createdAt: Date.now(),
      };

      if (profile.email && profile.email.includes('@')) {
        saveRegisteredAccount({
          email: profile.email,
          name: profile.name,
          organization: profile.organization,
          avatar: profile.avatar,
        });
        setSavedAccounts(loadSavedAccounts());
      }

      setTimeout(() => {
        setLoading(false);
        setSuccessMsg(`Đã tạo thí sinh ${profile.name} (0 điểm) sẵn sàng lưu dữ liệu!`);
        setTimeout(() => {
          onLogin(profile);
        }, 500);
      }, 400);
    }
  };

  // Bypass if email confirmation or rate limit blocked user
  const handleBypassEmailConfirm = async () => {
    const fallbackName = username.trim() || email.split('@')[0] || 'Thí sinh STEM';
    const safeEmail = email.trim() || `${fallbackName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}@ecosort.stem`;
    const profile: UserProfile = {
      id: 'user-' + Date.now(),
      name: fallbackName,
      email: safeEmail,
      organization: organization.trim() || 'Khối Sáng Tạo STEM',
      avatar: selectedAvatar,
      totalPoints: 0,
      correctCount: 0,
      organicCount: 0,
      recyclableCount: 0,
      inorganicCount: 0,
      createdAt: Date.now(),
    };

    if (profile.email && profile.email.includes('@')) {
      saveRegisteredAccount({
        email: profile.email,
        name: profile.name,
        organization: profile.organization,
        avatar: profile.avatar,
      });
      setSavedAccounts(loadSavedAccounts());
    }

    if (supabaseReady) {
      try {
        const client = getSupabase();
        if (client) {
          await client.from('players').upsert({
            id: profile.id,
            username: profile.name,
            email: profile.email,
            total_points: 0,
            correct_count: 0,
            organic_count: 0,
            recyclable_count: 0,
            inorganic_count: 0,
            avatar: profile.avatar,
            organization: profile.organization,
          });
        }
      } catch (err) {
        console.warn('Could not sync bypass profile to Supabase', err);
      }
    }

    setSuccessMsg(`Chào mừng ${profile.name}! Đã kích hoạt chế độ thi đấu trực tiếp (0 điểm).`);
    setTimeout(() => {
      onLogin(profile);
    }, 600);
  };

  const handleSignOut = async () => {
    playClickSound();
    setLoading(true);
    if (supabaseReady) {
      await signOutSupabase();
    }
    setLoading(false);
    if (onLogout) {
      onLogout();
    }
    setIsSwitchingMode(true);
  };

  const handleSwitchToNewContestant = () => {
    playClickSound();
    setUsername('');
    setEmail('');
    setPassword('');
    setError(null);
    setSuccessMsg(null);
    setAuthMode('quick');
    setIsSwitchingMode(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="login-dialog"
        className="relative w-full max-w-md bg-slate-900 border-2 border-slate-700/80 rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        {onClose && (
          <button
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border-2 border-emerald-500/40 mb-3 shadow-lg shadow-emerald-500/10">
            <span className="text-2xl select-none">{currentUser ? currentUser.avatar : selectedAvatar}</span>
          </div>
          <h2 className="text-lg font-black text-slate-100 tracking-tight">
            {currentUser ? 'Hồ Sơ Người Chơi STEM' : 'Supabase Authentication'}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                supabaseReady
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              <Database className="w-3 h-3" />
              {supabaseReady ? 'Database Online: Đã kết nối Supabase' : 'Chưa cấu hình Supabase URL'}
            </span>

            {onOpenSqlGuide && (
              <button
                type="button"
                onClick={onOpenSqlGuide}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-semibold cursor-pointer"
              >
                Xem lệnh SQL
              </button>
            )}
          </div>
        </div>

        {/* Current user active card if logged in and not switching */}
        {currentUser && !isSwitchingMode ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-950/80 border-2 border-slate-800 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Tên tài khoản:</span>
                <span className="text-sm font-bold text-slate-100">{currentUser.name}</span>
              </div>
              {currentUser.email && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Email:</span>
                  <span className="text-xs font-mono text-slate-300">{currentUser.email}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Đơn vị:</span>
                <span className="text-xs text-slate-300">{currentUser.organization}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Tổng điểm tích lũy:</span>
                <span className="text-base font-black text-amber-400">{currentUser.totalPoints} điểm</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Số lần phân loại đúng:</span>
                <span className="text-sm font-bold text-emerald-400">{currentUser.correctCount || 0} lần</span>
              </div>
            </div>

            {/* Switch / Add new contestant button */}
            <button
              type="button"
              onClick={handleSwitchToNewContestant}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-950/40"
            >
              <UserPlus className="w-4 h-4" />
              <span>Đổi Người Chơi / Đăng Ký Thí Sinh Mới</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="flex-1 py-2.5 px-3 bg-rose-950/80 hover:bg-rose-900 border-2 border-rose-500/50 text-rose-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng Xuất Tài Khoản</span>
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Đóng
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            {currentUser && isSwitchingMode && (
              <div className="mb-3 flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                <span className="text-slate-300 truncate">Đang đăng nhập: <strong>{currentUser.name}</strong></span>
                <button
                  type="button"
                  onClick={() => setIsSwitchingMode(false)}
                  className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-bold transition-all cursor-pointer"
                >
                  Quay lại hồ sơ
                </button>
              </div>
            )}

            {/* Tab switch: Quick Play vs Sign In vs Sign Up */}
            <div className="grid grid-cols-3 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setAuthMode('quick');
                  setError(null);
                  setErrorType(null);
                }}
                className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  authMode === 'quick'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Chơi Nhanh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setAuthMode('signin');
                  setError(null);
                  setErrorType(null);
                }}
                className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  authMode === 'signin'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                <span>Đăng Nhập</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setAuthMode('signup');
                  setError(null);
                  setErrorType(null);
                }}
                className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  authMode === 'signup'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-teal-400" />
                <span>Đăng Ký</span>
              </button>
            </div>

            {/* Danh sách các email / tài khoản đã đăng ký trong máy */}
            {savedAccounts.length > 0 && (
              <div className="mb-4 p-3 bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    Tài khoản đã đăng ký ({savedAccounts.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Bấm để điền nhanh</span>
                </div>
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {savedAccounts.map((acc) => (
                    <div
                      key={acc.email}
                      className="group flex items-center justify-between p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 transition-all text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setEmail(acc.email);
                          if (acc.name) setUsername(acc.name);
                          if (acc.organization) setOrganization(acc.organization);
                          if (acc.avatar) setSelectedAvatar(acc.avatar);
                          if (authMode === 'signup') setAuthMode('signin');
                        }}
                        className="flex-1 flex items-center gap-2 text-left cursor-pointer overflow-hidden"
                      >
                        <span className="text-base flex-shrink-0">{acc.avatar || '🌱'}</span>
                        <div className="truncate min-w-0">
                          <p className="font-semibold text-slate-200 group-hover:text-emerald-300 truncate">
                            {acc.name || acc.email.split('@')[0]}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{acc.email}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        title="Xóa tài khoản khỏi máy này"
                        onClick={(e) => {
                          e.stopPropagation();
                          playClickSound();
                          removeSavedAccount(acc.email);
                          setSavedAccounts(loadSavedAccounts());
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors ml-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error / Success alert with Actionable Resolution */}
            {error && (
              <div className="p-3 mb-4 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                  <span className="leading-relaxed font-medium">{error}</span>
                </div>

                {/* Smart Action Buttons according to error type */}
                {errorType === 'invalid_cred' && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-rose-900/60">
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setAuthMode('signup');
                        setError(null);
                        setErrorType(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-900 hover:bg-rose-800 text-white text-[11px] font-bold transition-all cursor-pointer"
                    >
                      👉 Bấm vào đây để Đăng Ký Mới
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setAuthMode('quick');
                        setError(null);
                        setErrorType(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-emerald-200 text-[11px] font-bold transition-all cursor-pointer"
                    >
                      ⚡ Chuyển sang Tham Gia Nhanh
                    </button>
                  </div>
                )}

                {errorType === 'email_not_confirmed' && (
                  <div className="pt-1 border-t border-rose-900/60">
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        handleBypassEmailConfirm();
                      }}
                      className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      🚀 Bỏ qua xác nhận email & Vào chơi ngay với tên này
                    </button>
                  </div>
                )}

                {errorType === 'email_rate_limit' && (
                  <div className="pt-2 border-t border-rose-900/60 space-y-2">
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          handleBypassEmailConfirm();
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Vào chơi & Lưu điểm ngay (Bỏ qua xác nhận mail)</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            setShowRateLimitGuide(!showRateLimitGuide);
                          }}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold transition-all border border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5 text-amber-400" />
                          <span>{showRateLimitGuide ? 'Ẩn cách tắt giới hạn' : 'Cách tắt giới hạn vĩnh viễn (Khuyên dùng)'}</span>
                          {showRateLimitGuide ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            setAuthMode('signin');
                            setError(null);
                            setErrorType(null);
                          }}
                          className="py-1.5 px-3 rounded-lg bg-slate-850 hover:bg-slate-800 text-cyan-300 text-[11px] font-semibold transition-all border border-slate-700 cursor-pointer"
                        >
                          Thử Đăng Nhập
                        </button>
                      </div>
                    </div>

                    {showRateLimitGuide && (
                      <div className="p-3 rounded-xl bg-slate-900/95 border border-amber-500/40 text-slate-200 text-[11px] space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center gap-1.5 font-bold text-amber-300">
                          <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span>Tại sao bị lỗi "email rate limit exceeded"?</span>
                        </div>
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          Gói miễn phí của Supabase mặc định chỉ cho phép gửi <strong>3-4 email/giờ</strong>. Khi nhiều người đăng ký, máy chủ gửi thư bị nghẽn và báo lỗi rate limit này.
                        </p>
                        <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-1.5">
                          <p className="font-bold text-emerald-400">Cách tắt chỉ trong 10 giây (Tài khoản kích hoạt tức thì):</p>
                          <ol className="list-decimal list-inside space-y-1 text-slate-300 leading-normal">
                            <li>Mở trang quản trị: <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-teal-400 underline font-semibold inline-flex items-center gap-0.5">supabase.com/dashboard <ExternalLink className="w-2.5 h-2.5 inline" /></a></li>
                            <li>Vào Dự án của bạn ➔ Chọn menu <strong>Authentication</strong> (ở thanh bên trái).</li>
                            <li>Chọn mục <strong>Providers</strong> ➔ Nhấp vào dòng <strong>Email</strong>.</li>
                            <li>Gạt tắt (Bỏ tích chọn) dòng <strong>"Confirm email"</strong> ➔ Nhấn <strong>Save</strong>.</li>
                          </ol>
                        </div>
                        <p className="text-[10px] text-emerald-300/90 font-medium">
                          ✨ Sau khi tắt mục này, thí sinh đăng ký là được kích hoạt ngay 100% không còn bị lỗi rate limit!
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {errorType === 'missing_table' && onOpenSqlGuide && (
                  <div className="pt-1 border-t border-rose-900/60">
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        onOpenSqlGuide();
                      }}
                      className="w-full py-1.5 px-3 rounded-lg bg-cyan-800 hover:bg-cyan-700 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      👉 Mở bảng xem và sao chép mã SQL
                    </button>
                  </div>
                )}
              </div>
            )}

            {successMsg && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* TAB 1: QUICK PLAY FORM (RECOMMENDED FOR CONTESTS) */}
            {authMode === 'quick' ? (
              <form onSubmit={handleQuickPlay} className="space-y-3.5">
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300">
                  ⚡ <strong>Chế độ tham gia nhanh:</strong> Không cần mật khẩu! Nhập tên thí sinh để tạo hồ sơ bắt đầu với <strong>0 điểm</strong> và tự động đồng bộ lên Bảng xếp hạng.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    Tên thí sinh / Đội thi STEM <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: Nguyễn Văn A hoặc STEM Team 11"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-teal-400" />
                      Email thí sinh (tùy chọn)
                    </span>
                    <span className="text-[10px] text-slate-400">Lưu vào bộ nhớ máy</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="thi-sinh@gmail.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5 text-amber-400" />
                    Lớp / Đơn vị / Trường
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="VD: Lớp 11A1 - THPT Chuyên"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  />
                </div>

                {/* Mascot / Avatar selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Chọn biểu tượng Mascot:
                  </label>
                  <div className="flex flex-wrap gap-1.5 justify-center py-1.5 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                    {DEFAULT_AVATARS.map((av) => (
                      <button
                        key={av}
                        type="button"
                        onClick={() => setSelectedAvatar(av)}
                        className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all cursor-pointer ${
                          selectedAvatar === av
                            ? 'bg-emerald-500/30 border-2 border-emerald-400 scale-110 shadow-md'
                            : 'hover:bg-slate-800 border border-transparent'
                        }`}
                      >
                        <span className="select-none">{av}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tạo thí sinh...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Bắt Đầu Tham Gia Ngay (0 Điểm)</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* TAB 2 & 3: SUPABASE EMAIL AUTH FORM */
              <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                      Tên người chơi / Đội thi <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="VD: Nguyễn Văn A hoặc STEM Team 11"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-teal-400" />
                    Email tài khoản <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="thi-sinh@gmail.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    Mật khẩu <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                  />
                </div>

                {authMode === 'signup' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                        <School className="w-3.5 h-3.5 text-amber-400" />
                        Lớp / Chi đội / Đơn vị tham gia
                      </label>
                      <input
                        type="text"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="VD: Lớp 10A2 - THPT Chuyên"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                      />
                    </div>

                    {/* Mascot / Avatar selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Chọn biểu tượng Mascot:
                      </label>
                      <div className="flex flex-wrap gap-1.5 justify-center py-1.5 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                        {DEFAULT_AVATARS.map((av) => (
                          <button
                            key={av}
                            type="button"
                            onClick={() => setSelectedAvatar(av)}
                            className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all cursor-pointer ${
                              selectedAvatar === av
                                ? 'bg-emerald-500/30 border-2 border-emerald-400 scale-110 shadow-md'
                                : 'hover:bg-slate-800 border border-transparent'
                            }`}
                          >
                            <span className="select-none">{av}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang kết nối cơ sở dữ liệu...</span>
                    </>
                  ) : authMode === 'signup' ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Đăng Ký & Khởi Tạo 0 Điểm</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Đăng Nhập Vào Hệ Thống</span>
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-4 pt-3 border-t border-slate-800 text-center">
              <p className="text-[11px] text-slate-400">
                {authMode === 'signup'
                  ? 'Khi đăng ký, tài khoản sẽ được khởi tạo với chính xác 0 điểm trên Database online.'
                  : 'Chỉ nhận điểm thi đua khi quét phân loại rác thực tế bằng webcam.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
