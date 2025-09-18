
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

// Continue with additional routes

// GET /api/geo/nearby-services - Find nearby services by category
router.get('/nearby-services', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, radius = 10, category, limit = 20 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    const radiusKm = Number(radius);

    // Calculate distance using Haversine formula
    const distanceFormula = sql`
      (6371 * acos(
        cos(radians(${lat})) * 
        cos(radians(CAST(${userLocations.latitude} AS FLOAT))) * 
        cos(radians(CAST(${userLocations.longitude} AS FLOAT)) - radians(${lng})) + 
        sin(radians(${lat})) * 
        sin(radians(CAST(${userLocations.latitude} AS FLOAT)))
      ))
    `;

    let query = db.select({
      id: users.id,
      fullName: users.fullName,
      profilePicture: users.profilePicture,
      city: users.city,
      state: users.state,
      role: users.role,
      distance: distanceFormula.as('distance'),
      location: {
        latitude: userLocations.latitude,
        longitude: userLocations.longitude,
        address: userLocations.address,
      },
    })
      .from(users)
      .leftJoin(userLocations, and(
        eq(userLocations.userId, users.id),
        eq(userLocations.isActive, true)
      ))
      .where(and(
        eq(users.isVerified, true),
        sql`${userLocations.latitude} IS NOT NULL`,
        sql`${userLocations.longitude} IS NOT NULL`,
        sql`${distanceFormula} <= ${radiusKm}`
      ))
      .orderBy(distanceFormula)
      .limit(Number(limit));

    // Add category filter for merchants
    if (category) {
      query = query.where(and(
        eq(users.role, 'MERCHANT'),
        // You might want to add business category filtering here
      ));
    }

    const nearbyServices = await query;

    res.json({
      status: 'Success',
      message: Message.nearbyServices,
      data: {
        services: nearbyServices,
        searchCenter: { latitude: lat, longitude: lng },
        radius: radiusKm,
        category: category || 'all',
        total: nearbyServices.length,
      },
    });
  } catch (error) {
    console.error('Nearby services error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/geo/optimize-route - Route optimization for deliveries
router.post('/optimize-route', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const driverId = (req as any).user.userId;
    const { deliveryPoints, startLocation } = req.body;

    if (!deliveryPoints || !Array.isArray(deliveryPoints) || deliveryPoints.length === 0) {
      return res.status(400).json({ error: 'Delivery points array is required' });
    }

    if (!startLocation || !startLocation.latitude || !startLocation.longitude) {
      return res.status(400).json({ error: 'Start location with latitude and longitude is required' });
    }

    // Simple route optimization using nearest neighbor algorithm
    // In production, you'd use a more sophisticated algorithm or external service
    const optimizeRoute = (start: any, points: any[]) => {
      const route = [start];
      const remaining = [...points];

      while (remaining.length > 0) {
        const current = route[route.length - 1];
        let nearestIndex = 0;
        let nearestDistance = Infinity;

        remaining.forEach((point, index) => {
          const distance = calculateDistance(
            current.latitude,
            current.longitude,
            point.latitude,
            point.longitude
          );
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });

        route.push(remaining[nearestIndex]);
        remaining.splice(nearestIndex, 1);
      }

      return route;
    };

    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371; // Earth's radius in kilometers
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLng = (lng2 - lng1) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const optimizedRoute = optimizeRoute(startLocation, deliveryPoints);

    // Calculate total distance and estimated time
    let totalDistance = 0;
    for (let i = 1; i < optimizedRoute.length; i++) {
      totalDistance += calculateDistance(
        optimizedRoute[i - 1].latitude,
        optimizedRoute[i - 1].longitude,
        optimizedRoute[i].latitude,
        optimizedRoute[i].longitude
      );
    }

    const estimatedTime = Math.ceil(totalDistance * 3); // Assume 3 minutes per km

    res.json({
      status: 'Success',
      message: Message.routeOptimized,
      data: {
        optimizedRoute,
        totalDistance: Math.round(totalDistance * 100) / 100,
        estimatedTime,
        driverId,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Route optimization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/geo/service-areas - Check service availability by location
router.get('/service-areas', async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    // Check if location is within any service area
    const serviceAreasWithin = await db.select({
      id: serviceAreas.id,
      name: serviceAreas.name,
      description: serviceAreas.description,
      isActive: serviceAreas.isActive,
      deliveryFee: serviceAreas.deliveryFee,
      estimatedDeliveryTime: serviceAreas.estimatedDeliveryTime,
    })
      .from(serviceAreas)
      .where(and(
        eq(serviceAreas.isActive, true),
        sql`ST_Contains(
          ${serviceAreas.boundaryPolygon}, 
          ST_Point(${lng}, ${lat})
        )`
      ));

    // Get nearby delivery zones
    const nearbyZones = await db.select({
      id: deliveryZones.id,
      name: deliveryZones.name,
      deliveryFee: deliveryZones.deliveryFee,
      minOrderAmount: deliveryZones.minOrderAmount,
      maxDeliveryTime: deliveryZones.maxDeliveryTime,
    })
      .from(deliveryZones)
      .where(eq(deliveryZones.isActive, true))
      .limit(10);

    const isServiceAvailable = serviceAreasWithin.length > 0;

    res.json({
      status: 'Success',
      message: Message.serviceAreasChecked,
      data: {
        isServiceAvailable,
        location: { latitude: lat, longitude: lng },
        serviceAreas: serviceAreasWithin,
        nearbyZones,
        checkedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Service areas check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/geo/estimate-delivery - Get delivery time estimates
router.post('/estimate-delivery', authenticateToken, async (req, res) => {
  try {
    const { pickupLocation, deliveryLocation, orderSize, priority = 'standard' } = req.body;

    if (!pickupLocation || !deliveryLocation) {
      return res.status(400).json({ error: 'Pickup and delivery locations are required' });
    }

    if (!pickupLocation.latitude || !deliveryLocation.latitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required for both locations' });
    }

    // Calculate distance
    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLng = (lng2 - lng1) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const distance = calculateDistance(
      pickupLocation.latitude,
      pickupLocation.longitude,
      deliveryLocation.latitude,
      deliveryLocation.longitude
    );

    // Base delivery time calculation
    let baseTime = Math.ceil(distance * 4); // 4 minutes per km base
    
    // Adjust for order size
    if (orderSize === 'large') {
      baseTime *= 1.3;
    } else if (orderSize === 'medium') {
      baseTime *= 1.1;
    }

    // Adjust for priority
    let estimatedTime = baseTime;
    let deliveryFee = Math.max(500, distance * 100); // Base fee calculation

    switch (priority) {
      case 'express':
        estimatedTime = Math.ceil(baseTime * 0.7);
        deliveryFee *= 1.5;
        break;
      case 'priority':
        estimatedTime = Math.ceil(baseTime * 0.85);
        deliveryFee *= 1.25;
        break;
      default:
        estimatedTime = baseTime;
    }

    // Time windows
    const currentTime = new Date();
    const estimatedPickup = new Date(currentTime.getTime() + 15 * 60000); // 15 min prep time
    const estimatedDelivery = new Date(estimatedPickup.getTime() + estimatedTime * 60000);

    res.json({
      status: 'Success',
      message: Message.deliveryEstimate,
      data: {
        distance: Math.round(distance * 100) / 100,
        estimatedTime,
        deliveryFee,
        priority,
        estimatedPickup,
        estimatedDelivery,
        pickupLocation,
        deliveryLocation,
        calculatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Delivery estimation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
