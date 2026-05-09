// In-memory unlock-session registry
// Holds RVK in memory keyed by unlock token with TTL and idle reset

import { randomBytes } from 'crypto';
import { zeroize } from './crypto';

export interface UnlockSession {
  unlockToken: string;
  rvk: Buffer;
  operatorSessionId: number;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
}

class UnlockSessionRegistry {
  private sessions: Map<string, UnlockSession> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired sessions every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 1000);
  }

  /**
   * Generate a cryptographically secure unlock token
   */
  generateUnlockToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Register a new unlock session
   */
  register(
    unlockToken: string,
    rvk: Buffer,
    operatorSessionId: number,
    ttlSeconds: number
  ): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    this.sessions.set(unlockToken, {
      unlockToken,
      rvk,
      operatorSessionId,
      createdAt: now,
      lastActivityAt: now,
      expiresAt,
    });
  }

  /**
   * Get an unlock session by token
   * Resets idle timer on access
   */
  get(unlockToken: string, idleResetSeconds: number): UnlockSession | null {
    const session = this.sessions.get(unlockToken);

    if (!session) {
      return null;
    }

    const now = new Date();

    // Check absolute expiry
    if (now > session.expiresAt) {
      this.remove(unlockToken);
      return null;
    }

    // Check idle timeout
    const idleTimeMs = now.getTime() - session.lastActivityAt.getTime();
    if (idleTimeMs > idleResetSeconds * 1000) {
      this.remove(unlockToken);
      return null;
    }

    // Reset idle timer
    session.lastActivityAt = now;

    return session;
  }

  /**
   * Remove an unlock session and zeroize RVK
   */
  remove(unlockToken: string): boolean {
    const session = this.sessions.get(unlockToken);

    if (session) {
      // Securely zeroize RVK before removing
      zeroize(session.rvk);
      this.sessions.delete(unlockToken);
      return true;
    }

    return false;
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredTokens: string[] = [];

    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        expiredTokens.push(token);
      }
    }

    for (const token of expiredTokens) {
      this.remove(token);
    }
  }

  /**
   * Remove all sessions (for shutdown)
   */
  removeAll(): void {
    for (const token of this.sessions.keys()) {
      this.remove(token);
    }
  }

  /**
   * Get session count (for monitoring)
   */
  count(): number {
    return this.sessions.size;
  }

  /**
   * Shutdown the registry
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.removeAll();
  }
}

// Singleton instance
const registry = new UnlockSessionRegistry();

export default registry;
