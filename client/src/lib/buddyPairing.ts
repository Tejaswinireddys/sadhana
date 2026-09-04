/** Client-side pairing validation so empty codes never hit a generic error. */

export function buddyPairingError(theirCode: string, myCode: string): string | null {
  const code = theirCode.trim().toUpperCase();
  if (!code) return "Enter your buddy’s SB- code to pair.";
  if (code === myCode.trim().toUpperCase()) {
    return "That’s your own code. Ask your buddy for theirs.";
  }
  return null;
}
