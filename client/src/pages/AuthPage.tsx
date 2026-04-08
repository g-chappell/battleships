import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { FONT_STYLES } from '../styles/fonts';
import { FormField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';

export function AuthPage({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const { login, register, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let success: boolean;
    if (mode === 'login') {
      success = await login(email, password);
    } else {
      success = await register(email, username, password);
    }
    if (success) onClose();
  };

  return (
    <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-coal to-mahogany border-2 border-blood rounded-lg p-8 w-96 shadow-2xl shadow-blood/40 panel-glow">
        <h2
          className="text-3xl text-center text-blood-bright mb-4"
          style={{ ...FONT_STYLES.pirate, textShadow: '0 0 10px rgba(196,30,58,0.4)' }}
        >
          {mode === 'login' ? 'Welcome Back, Captain' : 'Join the Crew'}
        </h2>

        <div className="flex gap-3 mb-5">
          <Button
            variant={mode === 'login' ? 'primary' : 'secondary'}
            size="sm"
            fullWidth
            onClick={() => { setMode('login'); clearError(); }}
          >
            Login
          </Button>
          <Button
            variant={mode === 'register' ? 'primary' : 'secondary'}
            size="sm"
            fullWidth
            onClick={() => { setMode('register'); clearError(); }}
          >
            Register
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {mode === 'register' && (
            <FormField
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}

          <FormField
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {error && (
            <p className="text-blood-bright text-sm italic" style={FONT_STYLES.body}>{error}</p>
          )}

          <Button type="submit" variant="primary" size="md" fullWidth disabled={isLoading}>
            {isLoading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-parchment/40 text-sm hover:text-parchment/70 transition-colors italic"
          style={FONT_STYLES.body}
        >
          Play as Guest
        </button>
      </div>
    </div>
  );
}
