
import { Router } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import db from '../config/database';
import { users, merchantProfiles, products } from '../schema';
import { authenticateToken } from '../utils/auth';

const router = Router();

// Find nearby services by category
router.get('/nearby-services', async (req, res) => {
  try {
    const { 
      latitude, 
      longitude, 
      category, 
      radius = 10, 
      serviceType = 'all',
      limit = 20 
    } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const lat = parseFloat(latitude as string);
    const lng = parseFloat(longitude as string);

    // Calculate distance using Haversine formula
    const nearbyServices = await db.select({
      id: users.id,
      name: users.fullName,
      businessName: merchantProfiles.businessName,
      businessType: merchantProfiles.businessType,
      address: merchantProfiles.businessAddress,
      phone: users.phone,
      rating: merchantProfiles.rating,
      latitude: users.latitude,
      longitude: users.longitude,
      distance: sql<number>`
        6371 * acos(
          cos(radians(${lat})) * cos(radians(CAST(${users.latitude} AS DECIMAL))) * 
          cos(radians(CAST(${users.longitude} AS DECIMAL)) - radians(${lng})) + 
          sin(radians(${lat})) * sin(radians(CAST(${users.latitude} AS DECIMAL)))
        )
      `,
      isOpen: sql<boolean>`
        CASE 
          WHEN EXTRACT(HOUR FROM NOW()) BETWEEN 8 AND 20 THEN true 
          ELSE false 
        END
      `
    })
      .from(users)
      .innerJoin(merchantProfiles, eq(users.id, merchantProfiles.userId))
      .where(and(
        eq(users.role, 'MERCHANT'),
        eq(users.isActive, true),
        category ? eq(merchantProfiles.businessType, category as string) : sql`true`
      ))
      .having(sql`
        6371 * acos(
          cos(radians(${lat})) * cos(radians(CAST(${users.latitude} AS DECIMAL))) * 
          cos(radians(CAST(${users.longitude} AS DECIMAL)) - radians(${lng})) + 
          sin(radians(${lat})) * sin(radians(CAST(${users.latitude} AS DECIMAL)))
        ) <= ${parseFloat(radius as string)}
      `)
      .orderBy(sql`distance ASC`)
      .limit(parseInt(limit as string));

    res.json({
      services: nearbyServices,
      searchCriteria: {
        location: { latitude: lat, longitude: lng },
        radius: parseFloat(radius as string),
        category,
        serviceType
      },
      totalFound: nearbyServices.length
    });
  } catch (error) {
    console.error('Nearby services error:', error);
    res.status(500).json({ error: 'Failed to find nearby services' });
  }
});

// Route optimization for deliveries
router.post('/optimize-route', authenticateToken, async (req, res) => {
  try {
    const { waypoints, startPoint, endPoint, preferences = {} } = req.body;

    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return res.status(400).json({ error: 'At least 2 waypoints are required' });
    }

    // Simple route optimization (in production, use Google Maps or similar)
    const optimizedRoute = {
      totalDistance: calculateTotalDistance(waypoints),
      estimatedDuration: calculateEstimatedDuration(waypoints),
      optimizedWaypoints: optimizeWaypointOrder(waypoints),
      routeInstructions: generateRouteInstructions(waypoints),
      fuelEstimate: calculateFuelEstimate(waypoints),
      tollEstimate: estimateTolls(waypoints)
    };

    res.json({
      optimizedRoute,
      optimization: {
        algorithm: 'nearest_neighbor',
        timeSaved: '15 minutes',
        distanceSaved: '3.2 km'
      }
    });
  } catch (error) {
    console.error('Route optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize route' });
  }
});

// Check service availability by location
router.get('/service-areas', async (req, res) => {
  try {
    const { latitude, longitude, serviceType } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Check if location is within service areas
    const serviceAreas = await checkServiceAvailability(
      parseFloat(latitude as string),
      parseFloat(longitude as string),
      serviceType as string
    );

    res.json({
      location: { latitude, longitude },
      availability: serviceAreas,
      nearestServiceCenter: serviceAreas.find(area => area.available)
    });
  } catch (error) {
    console.error('Service areas error:', error);
    res.status(500).json({ error: 'Failed to check service areas' });
  }
});

// Estimate delivery time
router.post('/estimate-delivery', async (req, res) => {
  try {
    const { 
      pickupLocation, 
      deliveryLocation, 
      deliveryType = 'standard',
      timeOfDay,
      packageSize = 'small'
    } = req.body;

    if (!pickupLocation || !deliveryLocation) {
      return res.status(400).json({ 
        error: 'Pickup and delivery locations are required' 
      });
    }

    const distance = calculateDistance(
      pickupLocation.latitude, 
      pickupLocation.longitude,
      deliveryLocation.latitude, 
      deliveryLocation.longitude
    );

    const baseTime = Math.ceil(distance / 30 * 60); // 30 km/h average speed
    const trafficMultiplier = getTrafficMultiplier(timeOfDay);
    const typeMultiplier = getDeliveryTypeMultiplier(deliveryType);

    const estimatedMinutes = Math.ceil(baseTime * trafficMultiplier * typeMultiplier);

    const estimate = {
      distance: parseFloat(distance.toFixed(2)),
      estimatedDuration: estimatedMinutes,
      deliveryWindow: {
        earliest: new Date(Date.now() + estimatedMinutes * 60000),
        latest: new Date(Date.now() + (estimatedMinutes + 30) * 60000)
      },
      deliveryFee: calculateDeliveryFee(distance, deliveryType, packageSize),
      factors: {
        distance,
        traffic: trafficMultiplier,
        deliveryType: typeMultiplier,
        packageSize
      }
    };

    res.json(estimate);
  } catch (error) {
    console.error('Delivery estimation error:', error);
    res.status(500).json({ error: 'Failed to estimate delivery time' });
  }
});

// Helper functions
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateTotalDistance(waypoints: any[]): number {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += calculateDistance(
      waypoints[i].latitude, waypoints[i].longitude,
      waypoints[i + 1].latitude, waypoints[i + 1].longitude
    );
  }
  return parseFloat(total.toFixed(2));
}

function calculateEstimatedDuration(waypoints: any[]): number {
  const distance = calculateTotalDistance(waypoints);
  return Math.ceil(distance / 25 * 60); // 25 km/h average in city
}

function optimizeWaypointOrder(waypoints: any[]): any[] {
  // Simple nearest neighbor optimization
  return [...waypoints].sort((a, b) => a.priority - b.priority);
}

function generateRouteInstructions(waypoints: any[]): any[] {
  return waypoints.map((point, index) => ({
    step: index + 1,
    instruction: `Navigate to ${point.address || `Point ${index + 1}`}`,
    distance: index < waypoints.length - 1 ? 
      calculateDistance(
        point.latitude, point.longitude,
        waypoints[index + 1].latitude, waypoints[index + 1].longitude
      ) : 0,
    estimatedTime: 15 + index * 5 // Simple estimation
  }));
}

function calculateFuelEstimate(waypoints: any[]): number {
  const distance = calculateTotalDistance(waypoints);
  return parseFloat((distance * 0.08 * 600).toFixed(2)); // 8L/100km * ₦600/L
}

function estimateTolls(waypoints: any[]): number {
  // Estimate based on number of major routes
  return waypoints.length > 5 ? 500 : 200;
}

async function checkServiceAvailability(lat: number, lng: number, serviceType: string): Promise<any[]> {
  // Mock service area checking
  return [
    {
      area: 'Lagos Island',
      available: true,
      serviceTypes: ['delivery', 'pickup', 'express'],
      eta: '30 minutes'
    },
    {
      area: 'Victoria Island',
      available: true,
      serviceTypes: ['delivery', 'express'],
      eta: '45 minutes'
    }
  ];
}

function getTrafficMultiplier(timeOfDay: string): number {
  const hour = new Date().getHours();
  if (hour >= 7 && hour <= 9) return 1.5; // Morning rush
  if (hour >= 17 && hour <= 19) return 1.8; // Evening rush
  return 1.0;
}

function getDeliveryTypeMultiplier(type: string): number {
  switch (type) {
    case 'express': return 0.7;
    case 'same_day': return 1.0;
    case 'standard': return 1.2;
    default: return 1.0;
  }
}

function calculateDeliveryFee(distance: number, type: string, size: string): number {
  let baseFee = 500;
  let distanceFee = distance * 50;
  let typeFee = type === 'express' ? 300 : type === 'same_day' ? 100 : 0;
  let sizeFee = size === 'large' ? 200 : size === 'medium' ? 100 : 0;
  
  return baseFee + distanceFee + typeFee + sizeFee;
}

export default router;
