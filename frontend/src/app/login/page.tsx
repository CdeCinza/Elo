'use strict';
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setAuthSession, User } from '@/lib/auth';
import { useToast } from '@/components/ui/ToastProvider';
import {
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  UtensilsCrossed,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning('Atenção', 'Informe seu e-mail e senha de acesso.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });

      const { user, access_token } = response.data;
      setAuthSession(user as User, access_token);

      toast.success(
        'Sessão iniciada',
        `Bem-vindo(a), ${user.name || 'Operador'}.`
      );

      setTimeout(() => {
        if (user.is_super_admin) {
          router.push('/superadmin');
        } else {
          router.push('/counter');
        }
      }, 300);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const errorMessage =
        errorObj.response?.data?.message ||
        errorObj.response?.data?.errors?.email?.[0] ||
        'Credenciais inválidas. Verifique os dados informados.';

      toast.error('Falha de Autenticação', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col justify-between items-center px-4 py-10 selection:bg-[#C84E1F] selection:text-white font-sans antialiased">
      {/* Top Subtle Header */}
      <header className="w-full max-w-sm flex items-center justify-between text-xs text-[#78716A]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-600" />
          <span className="font-mono text-[11px] font-medium">Sistema Operacional</span>
        </div>
        <span className="font-mono text-[11px] text-[#A8A199]">v2.4.0</span>
      </header>

      {/* Main Authentication Card */}
      <div className="w-full max-w-sm my-auto">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#C84E1F] text-white mb-3.5 shadow-xs">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h1 className="font-editorial text-2xl tracking-tight text-[#191817] font-semibold">
            ELO Gastronomia
          </h1>
          <p className="text-xs text-[#78716A] mt-1">
            Controle de Operações & Gestão
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-white border border-[#EAE6E1] rounded-2xl p-6 sm:p-7 shadow-xs">
          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-medium text-[#44403C] mb-1.5">
                E-mail de acesso
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@restaurante.com"
                  autoComplete="email"
                  required
                  className="w-full bg-[#FAF8F5] border border-[#E0DBD3] focus:border-[#C84E1F] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#191817] placeholder-[#A8A199] transition-colors outline-none font-sans"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[#44403C]">
                  Senha
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full bg-[#FAF8F5] border border-[#E0DBD3] focus:border-[#C84E1F] focus:bg-white rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-[#191817] placeholder-[#A8A199] transition-colors outline-none font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#78716A] hover:text-[#191817] p-1 cursor-pointer transition-colors"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#C84E1F] hover:bg-[#B34217] active:bg-[#9E3712] text-white font-medium py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Acessando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Context Note */}
          <div className="mt-5 pt-4 border-t border-[#EAE6E1] text-center">
            <p className="text-[11px] text-[#78716A] leading-relaxed">
              Acesse com suas credenciais de operador ou administrador. O sistema identificará automaticamente seu nível de acesso.
            </p>
          </div>
        </div>
      </div>

      {/* Footer System Status */}
      <footer className="w-full max-w-sm flex items-center justify-center gap-1.5 text-[11px] text-[#A8A199]">
        <span>ELO Platform &copy; {new Date().getFullYear()}</span>
        <span>•</span>
        <span>Acesso Seguro</span>
      </footer>
    </main>
  );
}