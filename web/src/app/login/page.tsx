import React, { useState } from 'react';
import { loginUser, registerUser } from '../../lib/api/auth.js';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

export default function LoginPage({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await registerUser(email, password);
      } else {
        await loginUser(email, password);
      }
      if (onLoginSuccess) {
        onLoginSuccess();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-[#181A20] border border-[#2B2F36] rounded-2xl p-6 md:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-[#F0B90B] rounded-lg mx-auto flex items-center justify-center font-black text-black text-xl mb-3">
            QS
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            {isRegister ? 'Create QuantScreen Account' : 'Welcome Back to QuantScreen'}
          </h1>
          <p className="text-xs text-[#848E9C] mt-1">
            Real-time multi-exchange order book screener and liquidity wall alerts
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#F6465D]/15 border border-[#F6465D]/30 text-[#F6465D] text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#848E9C] uppercase mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-[#848E9C]" size={16} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@quant.com"
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#F0B90B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#848E9C] uppercase mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-[#848E9C]" size={16} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#F0B90B]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-black font-bold rounded-lg text-sm transition flex items-center justify-center space-x-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <span>{isRegister ? 'Sign Up' : 'Log In'}</span>}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-[#848E9C]">
          <span>{isRegister ? 'Already have an account?' : "Don't have an account?"} </span>
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-[#F0B90B] hover:underline font-bold"
          >
            {isRegister ? 'Log In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
