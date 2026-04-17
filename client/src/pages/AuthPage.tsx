import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiFetch, ApiError } from '../services/apiClient';
import { FONT_STYLES } from '../styles/fonts';
import { FormField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Dialog, DialogContent, DialogTitle } from '../components/shadcn/dialog';
import { SECURITY_QUESTIONS } from '@shared/index';

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: '#150c0c',
  border: '1px solid rgba(139,0,0,0.6)',
  borderRadius: '0.375rem',
  color: '#e8dcc8',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  ...FONT_STYLES.body,
};

export function AuthPage({ onClose, initialMode = 'login' }: { onClose: () => void; initialMode?: 'login' | 'register' }) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // Security question state
  const [sq1Key, setSq1Key] = useState('');
  const [sq1Answer, setSq1Answer] = useState('');
  const [sq2Key, setSq2Key] = useState('');
  const [sq2Answer, setSq2Answer] = useState('');
  const [sqError, setSqError] = useState('');

  // Recovery flow state
  const [recoveryStep, setRecoveryStep] = useState<0 | 1 | 2 | 3>(0);
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryQuestions, setRecoveryQuestions] = useState<Array<{ key: string; question: string }>>([]);
  const [recoveryAnswers, setRecoveryAnswers] = useState<[string, string]>(['', '']);
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  const resetRecovery = () => {
    setRecoveryStep(0);
    setRecoveryIdentifier('');
    setRecoveryQuestions([]);
    setRecoveryAnswers(['', '']);
    setRecoveryToken('');
    setNewPassword('');
    setConfirmPassword('');
    setRecoveryError('');
    setRecoveryLoading(false);
    setRecoverySuccess(false);
  };

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoveryLoading(true);
    try {
      const data = await apiFetch<{ questions: Array<{ key: string; question: string }> }>(
        '/auth/recover/identify',
        { method: 'POST', json: { identifier: recoveryIdentifier } },
      );
      setRecoveryQuestions(data.questions);
      setRecoveryStep(2);
    } catch (err) {
      setRecoveryError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryAnswers[0].trim() || !recoveryAnswers[1].trim()) {
      setRecoveryError('Please answer both security questions');
      return;
    }
    setRecoveryError('');
    setRecoveryLoading(true);
    try {
      const data = await apiFetch<{ resetToken: string }>('/auth/recover/verify', {
        method: 'POST',
        json: {
          identifier: recoveryIdentifier,
          answers: [
            { questionKey: recoveryQuestions[0]?.key, answer: recoveryAnswers[0] },
            { questionKey: recoveryQuestions[1]?.key, answer: recoveryAnswers[1] },
          ],
        },
      });
      setRecoveryToken(data.resetToken);
      setRecoveryStep(3);
    } catch (err) {
      setRecoveryError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setRecoveryError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setRecoveryError('Passwords do not match');
      return;
    }
    setRecoveryError('');
    setRecoveryLoading(true);
    try {
      await apiFetch('/auth/recover/reset', {
        method: 'POST',
        json: { resetToken: recoveryToken, newPassword },
      });
      setRecoverySuccess(true);
    } catch (err) {
      setRecoveryError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const { login, register, isLoading, error, clearError } = useAuthStore();

  const clearSecurityQuestions = () => {
    setSq1Key('');
    setSq1Answer('');
    setSq2Key('');
    setSq2Answer('');
    setSqError('');
  };

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
      if (!sq1Key || !sq1Answer.trim() || !sq2Key || !sq2Answer.trim()) {
        setSqError('Please select two security questions and provide answers');
        return;
      }
      if (sq1Key === sq2Key) {
        setSqError('Please choose two different security questions');
        return;
      }
    }
    setEmailError('');
    setUsernameError('');
    setSqError('');
    let success: boolean;
    if (mode === 'login') {
      success = await login(email, password);
    } else {
      success = await register(email, username, password, [
        { questionKey: sq1Key, answer: sq1Answer },
        { questionKey: sq2Key, answer: sq2Answer },
      ]);
    }
    if (success) onClose();
  };

  const recoveryTitle =
    recoveryStep === 1 ? 'Recover Account' :
    recoveryStep === 2 ? 'Verify Identity' :
    'Reset Password';

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
          {recoveryStep > 0 ? recoveryTitle : (mode === 'login' ? 'Welcome Back, Captain' : 'Join the Crew')}
        </DialogTitle>

        {recoveryStep === 0 ? (
          <>
            <div className="flex gap-3 mb-5">
              <Button
                variant={mode === 'login' ? 'primary' : 'secondary'}
                size="sm"
                fullWidth
                onClick={() => { setMode('login'); clearError(); setEmailError(''); setUsernameError(''); clearSecurityQuestions(); }}
              >
                Login
              </Button>
              <Button
                variant={mode === 'register' ? 'primary' : 'secondary'}
                size="sm"
                fullWidth
                onClick={() => { setMode('register'); clearError(); setEmailError(''); setUsernameError(''); clearSecurityQuestions(); }}
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

              {mode === 'register' && (
                <>
                  <div className="pt-1">
                    <p className="text-parchment/60 text-xs mb-2" style={FONT_STYLES.labelSC}>Security Questions</p>
                    <div className="space-y-2">
                      <select
                        value={sq1Key}
                        onChange={(e) => { setSq1Key(e.target.value); if (sqError) setSqError(''); }}
                        style={selectStyle}
                        required
                      >
                        <option value="">— Select question 1 —</option>
                        {SECURITY_QUESTIONS.map(q => (
                          <option key={q.key} value={q.key} disabled={q.key === sq2Key}>{q.question}</option>
                        ))}
                      </select>
                      <FormField
                        type="text"
                        placeholder="Your answer"
                        value={sq1Answer}
                        onChange={(e) => { setSq1Answer(e.target.value); if (sqError) setSqError(''); }}
                      />
                      <select
                        value={sq2Key}
                        onChange={(e) => { setSq2Key(e.target.value); if (sqError) setSqError(''); }}
                        style={selectStyle}
                        required
                      >
                        <option value="">— Select question 2 —</option>
                        {SECURITY_QUESTIONS.map(q => (
                          <option key={q.key} value={q.key} disabled={q.key === sq1Key}>{q.question}</option>
                        ))}
                      </select>
                      <FormField
                        type="text"
                        placeholder="Your answer"
                        value={sq2Answer}
                        onChange={(e) => { setSq2Answer(e.target.value); if (sqError) setSqError(''); }}
                      />
                    </div>
                    {sqError && (
                      <p className="text-blood-bright text-sm italic mt-1" style={FONT_STYLES.body}>{sqError}</p>
                    )}
                  </div>
                </>
              )}

              {error && (
                <p className="text-blood-bright text-sm italic" style={FONT_STYLES.body}>{error}</p>
              )}

              <Button type="submit" variant="primary" size="md" fullWidth disabled={isLoading}>
                {isLoading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            {mode === 'login' && (
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => setRecoveryStep(1)}
                className="mt-2 text-parchment/40 hover:text-parchment/70"
                style={FONT_STYLES.body}
              >
                Forgot password?
              </Button>
            )}

            <Button
              variant="ghost"
              size="md"
              fullWidth
              onClick={onClose}
              className="mt-2 italic text-parchment/40 hover:text-parchment/70"
              style={FONT_STYLES.body}
            >
              Play as Guest
            </Button>
          </>
        ) : (
          <>
            {recoveryStep === 1 && (
              <form onSubmit={handleIdentify} className="space-y-3">
                <p className="text-parchment/70 text-sm mb-1" style={FONT_STYLES.body}>
                  Enter your username or email to find your account.
                </p>
                <FormField
                  type="text"
                  placeholder="Username or email"
                  value={recoveryIdentifier}
                  onChange={(e) => { setRecoveryIdentifier(e.target.value); setRecoveryError(''); }}
                  required
                />
                {recoveryError && (
                  <p className="text-blood-bright text-sm italic" style={FONT_STYLES.body}>{recoveryError}</p>
                )}
                <Button type="submit" variant="primary" size="md" fullWidth disabled={recoveryLoading}>
                  {recoveryLoading ? 'Searching...' : 'Find Account'}
                </Button>
              </form>
            )}

            {recoveryStep === 2 && (
              <form onSubmit={handleVerify} className="space-y-3">
                <p className="text-parchment/70 text-sm mb-1" style={FONT_STYLES.body}>
                  Answer your security questions to verify your identity.
                </p>
                {recoveryQuestions.map((q, i) => (
                  <div key={q.key}>
                    <p className="text-parchment/60 text-xs mb-1" style={FONT_STYLES.labelSC}>{q.question}</p>
                    <FormField
                      type="text"
                      placeholder="Your answer"
                      value={recoveryAnswers[i]}
                      onChange={(e) => {
                        const updated: [string, string] = [...recoveryAnswers] as [string, string];
                        updated[i] = e.target.value;
                        setRecoveryAnswers(updated);
                        setRecoveryError('');
                      }}
                      required
                    />
                  </div>
                ))}
                {recoveryError && (
                  <p className="text-blood-bright text-sm italic" style={FONT_STYLES.body}>{recoveryError}</p>
                )}
                <Button type="submit" variant="primary" size="md" fullWidth disabled={recoveryLoading}>
                  {recoveryLoading ? 'Verifying...' : 'Verify'}
                </Button>
              </form>
            )}

            {recoveryStep === 3 && (
              recoverySuccess ? (
                <div className="space-y-4 text-center">
                  <p className="text-gold text-base" style={FONT_STYLES.body}>
                    Password reset successfully! You can now log in with your new password.
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    onClick={resetRecovery}
                  >
                    Back to Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-3">
                  <p className="text-parchment/70 text-sm mb-1" style={FONT_STYLES.body}>
                    Choose a new password for your account.
                  </p>
                  <FormField
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setRecoveryError(''); }}
                    required
                    minLength={6}
                  />
                  <FormField
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setRecoveryError(''); }}
                    required
                  />
                  {recoveryError && (
                    <p className="text-blood-bright text-sm italic" style={FONT_STYLES.body}>{recoveryError}</p>
                  )}
                  <Button type="submit" variant="primary" size="md" fullWidth disabled={recoveryLoading}>
                    {recoveryLoading ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </form>
              )
            )}

            {!recoverySuccess && (
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={recoveryStep > 1 ? () => setRecoveryStep((s) => (s - 1) as 0 | 1 | 2 | 3) : resetRecovery}
                className="mt-3 text-parchment/40 hover:text-parchment/70"
                style={FONT_STYLES.body}
              >
                {recoveryStep > 1 ? '← Back' : '← Back to login'}
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
