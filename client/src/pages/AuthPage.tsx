import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { FONT_STYLES } from '../styles/fonts';
import { FormField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Dialog, DialogContent, DialogTitle } from '../components/shadcn/dialog';

export function AuthPage({ onClose, initialMode = 'login' }: { onClose: () => void; initialMode?: 'login' | 'register' }) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const { login, register, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register') {
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(username)) {
        setUsernameError('3–20 characters, letters, numbers, and underscores only');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setEmailError('Please enter a valid email address');
        return;
      }
    }
    setEmailError('');
    setUsernameError('');
    let success: boolean;
    if (mode === 'login') {
      success = await login(email, password);
    } else {
      success = await register(email, username, password);
    }
    if (success) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="bg-gradient-to-b from-coal to-mahogany border-2 border-blood rounded-lg p-8 max-w-sm sm:max-w-sm shadow-2xl shadow-blood/40 panel-glow ring-0"
      >
        <DialogTitle
          className="text-3xl text-center text-blood-bright mb-4"
          style={{ ...FONT_STYLES.pirate, textShadow: '0 0 10px rgba(196,30,58,0.4)' }}
        >
          {mode === 'login' ? 'Welcome Back, Captain' : 'Join the Crew'}
        </DialogTitle>

        <div className="flex gap-3 mb-5">
          <Button
            variant={mode === 'login' ? 'primary' : 'secondary'}
            size="sm"
            fullWidth
            onClick={() => { setMode('login'); clearError(); setEmailError(''); setUsernameError(''); }}
          >
            Login
          </Button>
          <Button
            variant={mode === 'register' ? 'primary' : 'secondary'}
            size="sm"
            fullWidth
            onClick={() => { setMode('register'); clearError(); setEmailError(''); setUsernameError(''); }}
          >
            Register
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField
            type={mode === 'register' ? 'email' : 'text'}
            placeholder={mode === 'register' ? 'Email' : 'Username or email'}
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
            required
          />
          {emailError && (
            <p className="text-blood-bright text-sm italic -mt-1" style={FONT_STYLES.body}>{emailError}</p>
          )}

          {mode === 'register' && (
            <>
              <FormField
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); if (usernameError) setUsernameError(''); }}
                required
              />
              {usernameError && (
                <p className="text-blood-bright text-sm italic -mt-1" style={FONT_STYLES.body}>{usernameError}</p>
              )}
            </>
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

        <Button
          variant="ghost"
          size="md"
          fullWidth
          onClick={onClose}
          className="mt-4 italic text-parchment/40 hover:text-parchment/70"
          style={FONT_STYLES.body}
        >
          Play as Guest
        </Button>
      </DialogContent>
    </Dialog>
  );
}
