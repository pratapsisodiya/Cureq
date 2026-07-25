import { Router } from 'express';
import { authenticateToken } from '../../shared/middleware/auth.middleware';
import { aiService } from './ai.service';

const router = Router();

/**
 * @route   POST /api/ai/triage
 * @desc    AI-powered patient triage based on chief complaint
 */
router.post('/triage', authenticateToken, async (req, res) => {
  const { chiefComplaint } = req.body;
  if (!chiefComplaint || chiefComplaint.trim().length < 3) {
    return res.status(400).json({ error: 'Chief complaint must be at least 3 characters.' });
  }

  try {
    const result = await aiService.triagePatient(chiefComplaint.trim());
    res.json(result);
  } catch (err) {
    console.error('Triage error:', err);
    res.status(500).json({ error: 'AI triage failed.' });
  }
});

/**
 * @route   POST /api/ai/structure-notes
 * @desc    Convert raw dictated clinical notes into SOAP format
 */
router.post('/structure-notes', authenticateToken, async (req, res) => {
  const { rawNotes } = req.body;
  if (!rawNotes || rawNotes.trim().length < 5) {
    return res.status(400).json({ error: 'Notes must be at least 5 characters.' });
  }

  try {
    const result = await aiService.structureClinicalNotes(rawNotes.trim());
    res.json(result);
  } catch (err) {
    console.error('SOAP structuring error:', err);
    res.status(500).json({ error: 'AI note structuring failed.' });
  }
});

/**
 * @route   POST /api/ai/noshow-risk
 * @desc    Calculate no-show risk score for a patient
 */
router.post('/noshow-risk', authenticateToken, async (req, res) => {
  const { patientPhone, clinicId } = req.body;
  if (!patientPhone || !clinicId) {
    return res.status(400).json({ error: 'patientPhone and clinicId are required.' });
  }

  try {
    const result = await aiService.getNoShowRisk(patientPhone, clinicId);
    res.json(result);
  } catch (err) {
    console.error('No-show risk error:', err);
    res.status(500).json({ error: 'Risk calculation failed.' });
  }
});

/**
 * @route   GET /api/ai/workload-balance/:branchId
 * @desc    Check queue balance across all doctors in a branch
 */
router.get('/workload-balance/:branchId', authenticateToken, async (req, res) => {
  const { branchId } = req.params;
  try {
    const result = await aiService.getWorkloadBalance(branchId);
    res.json(result);
  } catch (err) {
    console.error('Workload balance error:', err);
    res.status(500).json({ error: 'Workload check failed.' });
  }
});

/**
 * @route   POST /api/ai/patient-context
 * @desc    Generate a pre-consultation brief from patient's visit history
 */
router.post('/patient-context', authenticateToken, async (req, res) => {
  const { patientPhone, clinicId } = req.body;
  if (!patientPhone || !clinicId) {
    return res.status(400).json({ error: 'patientPhone and clinicId are required.' });
  }
  try {
    const result = await aiService.getPatientContextBrief(patientPhone, clinicId);
    res.json(result);
  } catch (err) {
    console.error('Patient context error:', err);
    res.status(500).json({ error: 'Patient context brief failed.' });
  }
});

/**
 * @route   POST /api/ai/followup-message
 * @desc    Generate a patient-friendly follow-up / discharge message
 */
router.post('/followup-message', authenticateToken, async (req, res) => {
  const { patientName, doctorName, clinicName, consultNotes, followUpDate } = req.body;
  if (!patientName || !consultNotes) {
    return res.status(400).json({ error: 'patientName and consultNotes are required.' });
  }
  try {
    const result = await aiService.generateFollowUpMessage({ patientName, doctorName, clinicName, consultNotes, followUpDate });
    res.json(result);
  } catch (err) {
    console.error('Follow-up message error:', err);
    res.status(500).json({ error: 'Follow-up message generation failed.' });
  }
});

/**
 * @route   POST /api/ai/generate-prescription
 * @desc    Generate structured prescription with drug interactions from SOAP notes
 */
router.post('/generate-prescription', authenticateToken, async (req, res) => {
  const { soapNotes, patientInfo } = req.body;
  if (!soapNotes || soapNotes.trim().length < 5) {
    return res.status(400).json({ error: 'SOAP notes must be at least 5 characters.' });
  }
  try {
    const result = await aiService.generatePrescription(soapNotes.trim(), patientInfo || {});
    res.json(result);
  } catch (err) {
    console.error('Prescription generation error:', err);
    res.status(500).json({ error: 'Prescription generation failed.' });
  }
});

/**
 * @route   POST /api/ai/check-drug-interactions
 * @desc    Check a list of prescribed medications for drug-drug interactions
 */
router.post('/check-drug-interactions', authenticateToken, async (req, res) => {
  const { medications } = req.body;
  if (!Array.isArray(medications)) {
    return res.status(400).json({ error: 'medications must be an array of drug names.' });
  }

  try {
    const result = await aiService.checkDrugInteractions(medications);
    res.json(result);
  } catch (err) {
    console.error('Drug interaction check error:', err);
    res.status(500).json({ error: 'Failed to check drug interactions.' });
  }
});

export default router;
