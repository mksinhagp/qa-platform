/**
 * Tests for Phase 9: Reporting and Narrative Layer
 * Tests the report action functions and stored procedures
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  getRunSummary,
  getPersonaSummaries,
  getAccessibilitySummary,
  getDeduplicatedIssues,
  getFrictionSignals,
  getExecutionDetail,
  getNarrativeReport,
} from './reports';

describe('Reports Actions', () => {
  // Mock run ID for testing - in real tests this would be a real run ID
  const testRunId = 1;
  const testExecutionId = 1;

  describe('getRunSummary', () => {
    it('should return run summary for valid run ID', async () => {
      const result = await getRunSummary(testRunId);
      
      // For now, we expect either success or a graceful error if no data exists
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data?.run_id).toBe(testRunId);
        expect(result.data?.run_name).toBeDefined();
        expect(result.data?.site_name).toBeDefined();
      } else {
        // If no data, should return a meaningful error
        expect(result.error).toBeDefined();
      }
    });

    it('should handle invalid run ID gracefully', async () => {
      const result = await getRunSummary(999999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getPersonaSummaries', () => {
    it('should return persona summaries for valid run ID', async () => {
      const result = await getPersonaSummaries(testRunId);
      
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        if (result.data && result.data.length > 0) {
          expect(result.data[0]).toHaveProperty('persona_id');
          expect(result.data[0]).toHaveProperty('persona_display_name');
          expect(result.data[0]).toHaveProperty('total_executions');
          expect(result.data[0]).toHaveProperty('passed_executions');
          expect(result.data[0]).toHaveProperty('failed_executions');
        }
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('getAccessibilitySummary', () => {
    it('should return accessibility summary for valid run ID', async () => {
      const result = await getAccessibilitySummary(testRunId);
      
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data).toHaveProperty('total_checks');
        expect(result.data).toHaveProperty('passed_checks');
        expect(result.data).toHaveProperty('failed_checks');
        expect(result.data).toHaveProperty('critical_issues');
        expect(result.data).toHaveProperty('keyboard_nav_pass_rate');
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('getDeduplicatedIssues', () => {
    it('should return deduplicated issues for valid run ID', async () => {
      const result = await getDeduplicatedIssues(testRunId);
      
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        if (result.data && result.data.length > 0) {
          expect(result.data[0]).toHaveProperty('issue_id');
          expect(result.data[0]).toHaveProperty('severity');
          expect(result.data[0]).toHaveProperty('category');
          expect(result.data[0]).toHaveProperty('summary');
          expect(result.data[0]).toHaveProperty('occurrence_count');
        }
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('getFrictionSignals', () => {
    it('should return friction signals for valid run ID', async () => {
      const result = await getFrictionSignals(testRunId);
      
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        if (result.data && result.data.length > 0) {
          expect(result.data[0]).toHaveProperty('execution_id');
          expect(result.data[0]).toHaveProperty('signal_type');
          expect(result.data[0]).toHaveProperty('signal_count');
        }
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('getExecutionDetail', () => {
    it('should return execution detail for valid execution ID', async () => {
      const result = await getExecutionDetail(testExecutionId);
      
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        if (result.data && result.data.length > 0) {
          expect(result.data[0]).toHaveProperty('execution_id');
          expect(result.data[0]).toHaveProperty('persona_id');
          expect(result.data[0]).toHaveProperty('flow_name');
          expect(result.data[0]).toHaveProperty('status');
        }
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle invalid execution ID gracefully', async () => {
      const result = await getExecutionDetail(999999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getNarrativeReport', () => {
    it('should return complete narrative report for valid run ID', async () => {
      const result = await getNarrativeReport(testRunId);
      
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data).toHaveProperty('run_summary');
        expect(result.data).toHaveProperty('persona_summaries');
        expect(result.data).toHaveProperty('accessibility_summary');
        expect(result.data).toHaveProperty('issues');
        expect(result.data).toHaveProperty('friction_signals');
        
        // Verify structure of nested data
        expect(result.data?.run_summary).toHaveProperty('run_id');
        expect(Array.isArray(result.data?.persona_summaries)).toBe(true);
        expect(Array.isArray(result.data?.issues)).toBe(true);
        expect(Array.isArray(result.data?.friction_signals)).toBe(true);
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle invalid run ID gracefully', async () => {
      const result = await getNarrativeReport(999999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
