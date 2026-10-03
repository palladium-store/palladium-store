/** "Continue with Google". A plain link (no client JavaScript): the server route sends the visitor to Google and back. */
export function GoogleButton({ next, label = 'Continue with Google' }: { next: string | null; label?: string }) {
  const href = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : '/api/auth/google';
  return (
    <div className="mb-6">
      <a href={href} className="flex w-full items-center justify-center gap-3 border border-ink bg-white px-4 py-3.5 text-sm font-semibold text-ink transition hover:bg-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {label}
      </a>
      <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-mute" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />or use email<span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

export const GOOGLE_MESSAGES: Record<string, string> = {
  cancelled: 'Google sign-in was cancelled.',
  expired: 'That sign-in link expired. Please try again.',
  failed: 'We could not sign you in with Google. Please try again or use your email and password.',
  staff: 'Staff accounts sign in with email and password.',
  unavailable: 'Google sign-in is not available right now. Please use your email and password.',
  busy: 'Too many attempts. Please wait a few minutes and try again.',
};
