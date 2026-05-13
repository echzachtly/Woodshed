/** Maps common Supabase auth errors to short UI copy. */
export function formatAuthError(error: Error | null): string {
  if (!error) return "Something went wrong. Try again.";
  const msg = error.message.toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (msg.includes("email not confirmed")) {
    return "Confirm your email before signing in.";
  }
  if (msg.includes("user already registered")) {
    return "An account with this email already exists. Try logging in.";
  }
  if (msg.includes("password")) {
    return error.message;
  }
  if (msg.includes("email")) {
    return error.message;
  }

  return error.message || "Something went wrong. Try again.";
}
