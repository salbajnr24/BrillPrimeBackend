
import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import db from '../config/database';
import { openingHours, merchantProfiles } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';

const router = Router();

// Get vendor opening hours
router.get('/:vendorId', async (req, res) => {
  try {
    const { vendorId } = req.params;

    const hours = await db.select()
      .from(openingHours)
      .where(and(
        eq(openingHours.vendorId, vendorId),
        eq(openingHours.isDeleted, false)
      ))
      .orderBy(openingHours.dayOfWeek);

    res.json({
      status: 'Success',
      message: 'Opening hours fetched successfully',
      data: hours,
    });
  } catch (error) {
    console.error('Get opening hours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set vendor opening hours (Merchant only)
router.post('/', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;
    const { schedule } = req.body; // Array of {dayOfWeek, openTime, closeTime}

    if (!Array.isArray(schedule)) {
      return res.status(400).json({ error: 'Schedule must be an array' });
    }

    // Get merchant profile
    const merchant = await db.select()
      .from(merchantProfiles)
      .where(eq(merchantProfiles.userId, merchantId));

    if (merchant.length === 0) {
      return res.status(404).json({ error: 'Merchant profile not found' });
    }

    const vendorId = merchant[0].id;

    // Delete existing opening hours
    await db.update(openingHours)
      .set({ isDeleted: true })
      .where(eq(openingHours.vendorId, vendorId));

    // Insert new opening hours
    const hoursToInsert = schedule.map((item: any) => ({
      vendorId,
      dayOfWeek: item.dayOfWeek,
      openTime: item.openTime,
      closeTime: item.closeTime,
    }));

    const newHours = await db.insert(openingHours)
      .values(hoursToInsert)
      .returning();

    res.json({
      status: 'Success',
      message: 'Opening hours updated successfully',
      data: newHours,
    });
  } catch (error) {
    console.error('Set opening hours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update specific day opening hours
router.put('/:dayOfWeek', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;
    const { dayOfWeek } = req.params;
    const { openTime, closeTime } = req.body;

    // Get merchant profile
    const merchant = await db.select()
      .from(merchantProfiles)
      .where(eq(merchantProfiles.userId, merchantId));

    if (merchant.length === 0) {
      return res.status(404).json({ error: 'Merchant profile not found' });
    }

    const vendorId = merchant[0].id;

    // Update or insert opening hours for specific day
    const existing = await db.select()
      .from(openingHours)
      .where(and(
        eq(openingHours.vendorId, vendorId),
        eq(openingHours.dayOfWeek, dayOfWeek),
        eq(openingHours.isDeleted, false)
      ));

    let result;
    if (existing.length > 0) {
      result = await db.update(openingHours)
        .set({ openTime, closeTime })
        .where(eq(openingHours.id, existing[0].id))
        .returning();
    } else {
      result = await db.insert(openingHours)
        .values({
          vendorId,
          dayOfWeek,
          openTime,
          closeTime,
        })
        .returning();
    }

    res.json({
      status: 'Success',
      message: 'Opening hours updated successfully',
      data: result[0],
    });
  } catch (error) {
    console.error('Update opening hours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
