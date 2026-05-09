import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@qa-platform/auth';
import { invokeProcWrite, query, initializePool } from '@qa-platform/db';
import { loadEnv } from '@qa-platform/config';

// Initialize on first request
let initialized = false;
async function ensureInitialized() {
  if (!initialized) {
    loadEnv();
    initializePool();
    initialized = true;
  }
}

// This endpoint is only available in development/test environments
export async function POST(request: NextRequest) {
  // Security check - only allow in non-production environments
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    await ensureInitialized();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'createOperator': {
        const { operator } = body;

        // Hash the password
        const passwordHash = await hashPassword(operator.password);

        try {
          // Create operator using stored procedure
          const result = await invokeProcWrite('sp_operators_insert', {
            i_login: operator.login,
            i_password_hash: passwordHash,
            i_full_name: operator.full_name,
            i_email: operator.email,
            i_active: true,
            i_created_by: 'system',
          });

          return NextResponse.json({ success: true, operatorId: result[0]?.o_id });
        } catch (error: any) {
          // If operator already exists (unique constraint violation), that's OK
          if (error.message?.includes('unique constraint') || error.message?.includes('duplicate')) {
            return NextResponse.json({ success: true, message: 'Operator already exists' });
          }
          throw error;
        }
      }

      case 'resetVault': {
        // Reset vault to unbootstrapped state
        // This is a test-only operation using direct SQL
        await query('DELETE FROM vault_unlock_sessions');
        await query('DELETE FROM secret_access_logs');
        await query('DELETE FROM secret_records');
        await query('DELETE FROM vault_state');

        return NextResponse.json({ success: true, message: 'Vault reset' });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Test setup error:', error);
    return NextResponse.json(
      { error: 'Setup failed', details: error.message },
      { status: 500 }
    );
  }
}
