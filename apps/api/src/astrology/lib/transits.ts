import { ASPECT_TYPES, type ChartData, type Planet, type TransitAspect, type TransitData } from '@pl-cms/shared';
import { generateChartData } from '../chart-engine';

function calculateTransitAspects(transitPlanets: Planet[], natalPlanets: Planet[]): TransitAspect[] {
  const transitAspects: TransitAspect[] = [];

  for (const transitPlanet of transitPlanets) {
    for (const natalPlanet of natalPlanets) {
      let angle = Math.abs(transitPlanet.longitude - natalPlanet.longitude);
      if (angle > 180) angle = 360 - angle;

      for (const aspectType of Object.values(ASPECT_TYPES)) {
        const diff = Math.abs(angle - aspectType.angle);
        if (diff <= aspectType.orb) {
          transitAspects.push({
            transitPlanet: transitPlanet.name,
            natalPlanet: natalPlanet.name,
            type: aspectType.name,
            orb: diff,
            angle: aspectType.angle,
            color: aspectType.color,
          });
        }
      }
    }
  }

  return transitAspects;
}

export function calculateTransitsForDate(natalChart: ChartData, date: Date): TransitData {
  const transitChart = generateChartData({
    name: 'Transit',
    date: date.toISOString().slice(0, 10),
    time: `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`,
    location: natalChart.location,
    latitude: natalChart.latitude,
    longitude: natalChart.longitude,
    timezone: '+00:00',
    coordinateSource: 'provided',
  });

  const transitAspects = calculateTransitAspects(transitChart.planets, natalChart.planets);

  return {
    planets: transitChart.planets,
    aspects: transitAspects,
    calculatedAt: date,
  };
}

export function calculateCurrentTransits(natalChart: ChartData): TransitData {
  return calculateTransitsForDate(natalChart, new Date());
}
