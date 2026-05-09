import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@qa-platform/auth';
import { invokeProcWrite, initializePool } from '@qa-platform/db';
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
  if (process.env.NODE_ENV !== 'test' && process.env.E2E_TEST_MODE !== 'true') {
    return NextResponse.json({ error: 'Test setup is disabled' }, { status: 403 });
  }

  const expectedToken = process.env.TEST_SETUP_TOKEN;
  const providedToken = request.headers.get('x-test-setup-token');
  if (!expectedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        await invokeProcWrite('sp_test_vault_reset', {
          i_updated_by: 'test_setup',
        });

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
